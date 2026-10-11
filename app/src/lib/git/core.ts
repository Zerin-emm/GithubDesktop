import {
  exec,
  GitError as DugiteError,
  parseError,
  IGitResult as DugiteResult,
  IGitExecutionOptions as DugiteExecutionOptions,
  parseBadConfigValueErrorInfo,
  ExecError,
} from 'dugite'

import { assertNever } from '../fatal-error'
import * as GitPerf from '../../ui/lib/git-perf'
import * as Path from 'path'
import { isErrnoException } from '../errno-exception'
import { merge } from '../merge'
import { withTrampolineEnv } from '../trampoline/trampoline-environment'
import { createTailStream } from './create-tail-stream'
import { createTerminalStream } from '../create-terminal-stream'
import { kStringMaxLength } from 'buffer'

export const coerceToString = (
  value: string | Buffer,
  encoding: BufferEncoding = 'utf8'
) => (Buffer.isBuffer(value) ? value.toString(encoding) : value)

export const coerceToBuffer = (
  value: string | Buffer,
  encoding: BufferEncoding = 'utf8'
) => (Buffer.isBuffer(value) ? value : Buffer.from(value, encoding))

export const isMaxBufferExceededError = (
  error: unknown
): error is ExecError & { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' } => {
  return (
    error instanceof ExecError &&
    error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'
  )
}

/**
 * An extension of the execution options in dugite that
 * allows us to piggy-back our own configuration options in the
 * same object.
 */
export interface IGitExecutionOptions extends DugiteExecutionOptions {
  /**
   * The exit codes which indicate success to the
   * caller. Unexpected exit codes will be logged and an
   * error thrown. Defaults to 0 if undefined.
   */
  readonly successExitCodes?: ReadonlySet<number>

  /**
   * The git errors which are expected by the caller. Unexpected errors will
   * be logged and an error thrown.
   */
  readonly expectedErrors?: ReadonlySet<DugiteError>

  /** Should it track & report LFS progress? */
  readonly trackLFSProgress?: boolean

  /**
   * Whether the command about to run is part of a background task or not.
   * This affects error handling and UI such as credential prompts.
   */
  readonly isBackgroundTask?: boolean
}

/**
 * The result of using `git`. This wraps dugite's results to provide
 * the parsed error if one occurs.
 */
export interface IGitResult extends DugiteResult {
  /**
   * The parsed git error. This will be null when the exit code is included in
   * the `successExitCodes`, or when dugite was unable to parse the
   * error.
   */
  readonly gitError: DugiteError | null

  /** The human-readable error description, based on `gitError`. */
  readonly gitErrorDescription: string | null

  /**
   * The path that the Git command was executed from, i.e. the
   * process working directory (not to be confused with the Git
   * working directory which is... super confusing, I know)
   */
  readonly path: string
}

/** The result of shelling out to git using a string encoding (default) */
export interface IGitStringResult extends IGitResult {
  /** The standard output from git. */
  readonly stdout: string

  /** The standard error output from git. */
  readonly stderr: string
}

export interface IGitStringExecutionOptions extends IGitExecutionOptions {
  readonly encoding?: BufferEncoding
}

export interface IGitBufferExecutionOptions extends IGitExecutionOptions {
  readonly encoding: 'buffer'
}

/** The result of shelling out to git using a buffer encoding */
export interface IGitBufferResult extends IGitResult {
  /** The standard output from git. */
  readonly stdout: Buffer

  /** The standard error output from git. */
  readonly stderr: Buffer
}

export class GitError extends Error {
  /** The result from the failed command. */
  public readonly result: IGitResult

  /** The args for the failed command. */
  public readonly args: ReadonlyArray<string>

  /**
   * Whether or not the error message is just the raw output of the git command.
   */
  public readonly isRawMessage: boolean

  public constructor(
    result: IGitResult,
    args: ReadonlyArray<string>,
    terminalOutput: string
  ) {
    let rawMessage = true
    let message

    if (result.gitErrorDescription) {
      message = result.gitErrorDescription
      rawMessage = false
    } else if (terminalOutput.length > 0) {
      message = terminalOutput
    } else if (result.stderr.length) {
      message = coerceToString(result.stderr)
    } else if (result.stdout.length) {
      message = coerceToString(result.stdout)
    } else {
      message = `Unknown error (exit code ${result.exitCode})`
      rawMessage = false
    }

    super(message)

    this.name = 'GitError'
    this.result = result
    this.args = args
    this.isRawMessage = rawMessage
  }
}

export const isGitError = (
  e: unknown,
  parsedError?: DugiteError
): e is GitError => {
  return (
    e instanceof GitError &&
    (parsedError === undefined || e.result.gitError === parsedError)
  )
}

/**
 * Shell out to git with the given arguments, at the given path.
 *
 * @param args             The arguments to pass to `git`.
 *
 * @param path             The working directory path for the execution of the
 *                         command.
 *
 * @param name             The name for the command based on its caller's
 *                         context. This will be used for performance
 *                         measurements and debugging.
 *
 * @param options          Configuration options for the execution of git,
 *                         see IGitExecutionOptions for more information.
 *
 * Returns the result. If the command exits with a code not in
 * `successExitCodes` or an error not in `expectedErrors`, a `GitError` will be
 * thrown.
 */
export async function git(
  args: string[],
  path: string,
  name: string,
  options?: IGitStringExecutionOptions
): Promise<IGitStringResult>
export async function git(
  args: string[],
  path: string,
  name: string,
  options?: IGitBufferExecutionOptions
): Promise<IGitBufferResult>
export async function git(
  args: string[],
  path: string,
  name: string,
  options?: IGitExecutionOptions
): Promise<IGitResult> {
  const defaultOptions: IGitExecutionOptions = {
    successExitCodes: new Set([0]),
    expectedErrors: new Set(),
    maxBuffer: options?.encoding === 'buffer' ? Infinity : kStringMaxLength,
  }

  const opts = { ...defaultOptions, ...options }

  // The combined contents of stdout and stderr with some light processing
  // applied to remove redundant lines caused by Git's use of `\r` to "erase"
  // the current line while writing progress output. See createTerminalOutput.
  //
  // Note: The output is capped at a maximum of 256kb and the sole intent of
  // this property is to provide "terminal-like" output to the user when a Git
  // command fails.
  let terminalOutput = ''

  // Keep at most 256kb of combined stderr and stdout output. This is used
  // to provide more context in error messages.
  opts.processCallback = process => {
    const terminalStream = createTerminalStream()
    const tailStream = createTailStream(256 * 1024, { encoding: 'utf8' })

    terminalStream
      .pipe(tailStream)
      .on('data', (data: string) => (terminalOutput = data))
      .on('error', e => log.error(`Terminal output error`, e))

    process.stdout?.pipe(terminalStream, { end: false })
    process.stderr?.pipe(terminalStream, { end: false })
    process.on('close', () => terminalStream.end())
    options?.processCallback?.(process)
  }

  return withTrampolineEnv(
    async env => {
      const combinedEnv = merge(opts.env, env)

      // Explicitly set TERM to 'dumb' so that if Desktop was launched
      // from a terminal or if the system environment variables
      // have TERM set Git won't consider us as a smart terminal.
      // See https://github.com/git/git/blob/a7312d1a2/editor.c#L11-L15
      opts.env = { TERM: 'dumb', ...combinedEnv }

      const commandName = `${name}: git ${args.join(' ')}`

      const result = await GitPerf.measure(commandName, () =>
        exec(args, path, opts)
      ).catch(err => {
        // If this is an exception thrown by Node.js (as opposed to
        // dugite) let's keep the salient details but include the name of
        // the operation.
        if (isErrnoException(err)) {
          throw new Error(`Failed to execute ${name}: ${err.code}`)
        }

        if (isMaxBufferExceededError(err)) {
          throw new ExecError(
            `${err.message} for ${name}`,
            err.stdout,
            err.stderr,
            // Dugite stores the original Node error in the cause property, by
            // passing that along we ensure that all we're doing here is
            // changing the error message (and capping the stack but that's
            // okay since we know exactly where this error is coming from).
            // The null coalescing here is a safety net in case dugite's
            // behavior changes from underneath us.
            err.cause ?? err
          )
        }

        throw err
      })

      const exitCode = result.exitCode

      let gitError: DugiteError | null = null
      const acceptableExitCode = opts.successExitCodes
        ? opts.successExitCodes.has(exitCode)
        : false
      if (!acceptableExitCode) {
        gitError = parseError(coerceToString(result.stderr))
        if (gitError === null) {
          gitError = parseError(coerceToString(result.stdout))
        }
      }

      const gitErrorDescription =
        gitError !== null
          ? getDescriptionForError(gitError, coerceToString(result.stderr))
          : null
      const gitResult = {
        ...result,
        gitError,
        gitErrorDescription,
        path,
      }

      let acceptableError = true
      if (gitError !== null && opts.expectedErrors) {
        acceptableError = opts.expectedErrors.has(gitError)
      }

      if ((gitError !== null && acceptableError) || acceptableExitCode) {
        return gitResult
      }

      // The caller should either handle this error, or expect that exit code.
      const errorMessage = new Array<string>()
      errorMessage.push(
        `\`git ${args.join(' ')}\` exited with an unexpected code: ${exitCode}.`
      )

      if (terminalOutput.length > 0) {
        // Leave even less of the combined output in the log
        errorMessage.push(terminalOutput.slice(-1024))
      }

      if (gitError !== null) {
        errorMessage.push(
          `(The error was parsed as ${gitError}: ${gitErrorDescription})`
        )
      }

      log.error(errorMessage.join('\n'))

      throw new GitError(gitResult, args, terminalOutput)
    },
    path,
    options?.isBackgroundTask ?? false,
    options?.env
  )
}

/**
 * Determine whether the provided `error` is an authentication failure
 * as per our definition. Note that this is not an exhaustive list of
 * authentication failures, only a collection of errors that we treat
 * equally in terms of error message and presentation to the user.
 */
export function isAuthFailureError(
  error: DugiteError
): error is
  | DugiteError.SSHAuthenticationFailed
  | DugiteError.SSHPermissionDenied
  | DugiteError.HTTPSAuthenticationFailed {
  switch (error) {
    case DugiteError.SSHAuthenticationFailed:
    case DugiteError.SSHPermissionDenied:
    case DugiteError.HTTPSAuthenticationFailed:
      return true
  }
  return false
}

/**
 * Determine whether the provided `error` is an error from Git indicating
 * that a configuration file  write failed due to a lock file already
 * existing for that config file.
 */
export function isConfigFileLockError(error: Error): error is GitError {
  return (
    error instanceof GitError &&
    error.result.gitError === DugiteError.ConfigLockFileAlreadyExists
  )
}

const lockFilePathRe = /^error: could not lock config file (.+?): File exists$/m

/**
 * If the `result` is associated with an config lock file error (as determined
 * by `isConfigFileLockError`) this method will attempt to extract an absolute
 * path (i.e. rooted) to the configuration lock file in question from the Git
 * output.
 */
export function parseConfigLockFilePathFromError(result: IGitResult) {
  const match = lockFilePathRe.exec(coerceToString(result.stderr))

  if (match === null) {
    return null
  }

  // Git on Windows may print the config file path using forward slashes.
  // Luckily for us forward slashes are not allowed in Windows file or
  // directory names so we can simply replace any instance of forward
  // slashes with backslashes.
  const normalized = __WIN32__ ? match[1].replace('/', '\\') : match[1]

  // https://github.com/git/git/blob/232378479/lockfile.h#L117-L119
  return Path.resolve(result.path, `${normalized}.lock`)
}

export function getDescriptionForError(
  error: DugiteError,
  stderr: string
): string | null {
  if (isAuthFailureError(error)) {
    const menuHint = __DARWIN__
      ? 'GitHub Desktop > Settings.'
      : 'File > Options.'
    return `身份验证失败。一些常见原因包括：

- 您尚未登录到您的帐户：请参阅 ${menuHint}
- 您可能需要注销并重新登录才能刷新令牌。
- 您没有访问此存储库的权限。
- 存储库存档在 GitHub 上。检查存储库设置以确认您仍可以推送提交。
- 如果您使用 SSH 身份验证，请检查您的密钥是否已添加到 ssh 代理并与您的帐户关联。
- 如果使用 SSH 身份验证，请确保存储库托管服务的主机密钥验证通过。
- 如果使用了用户名/密码身份验证，则可能需要使用个人访问令牌而不是帐户密码。请查看存储库托管服务的文档。`
  }

  switch (error) {
    case DugiteError.BadConfigValue:
      const errorInfo = parseBadConfigValueErrorInfo(stderr)
      if (errorInfo === null) {
        return 'Unsupported git configuration value.'
      }

      return `Unsupported value '${errorInfo.value}' for git config key '${errorInfo.key}'`
    case DugiteError.SSHKeyAuditUnverified:
      return "SSH密钥未验证."
    case DugiteError.RemoteDisconnection:
      return "远程已断开连接。请检查您的Internet连接，然后重试."
    case DugiteError.HostDown:
      return "主机已关闭。请检查您的Internet连接，然后重试."
    case DugiteError.RebaseConflicts:
      return "我们在尝试重新变基时发现了一些冲突。请在继续之前解决冲突."
    case DugiteError.MergeConflicts:
      return "尝试合并时发现一些冲突。请解决冲突并提交更改."
    case DugiteError.HTTPSRepositoryNotFound:
    case DugiteError.SSHRepositoryNotFound:
      return "存储库似乎不再存在。您可能没有访问权限，或者它可能已被删除或重命名."
    case DugiteError.PushNotFastForward:
      return "自上次提取后，存储库已更新。在推送之前试着拉取."
    case DugiteError.BranchDeletionFailed:
      return "无法删除分支。它可能已被删除."
    case DugiteError.DefaultBranchDeletionFailed:
      return "该分支是仓库的默认分支，无法删除."
    case DugiteError.RevertConflicts:
      return "要完成还原，请合并并提交更改."
    case DugiteError.EmptyRebasePatch:
      return "没有要应用的任何更改."
    case DugiteError.NoMatchingRemoteBranch:
      return "没有任何与当前分支匹配的远程分支."
    case DugiteError.NothingToCommit:
      return "没有要提交的更改."
    case DugiteError.NoSubmoduleMapping:
      return "已从 .gitmodules 中删除子模块,但该文件夹仍存在于仓库中。请删除该文件夹,提交更改后重试。"
    case DugiteError.SubmoduleRepositoryDoesNotExist:
      return "子模块指向不存在的位置."
    case DugiteError.InvalidSubmoduleSHA:
      return "子模块指向不存在的提交."
    case DugiteError.LocalPermissionDenied:
      return "权限被拒绝。"
    case DugiteError.InvalidMerge:
      return "这不是我们可以合并的东西."
    case DugiteError.InvalidRebase:
      return "这不是我们可以调整的变基."
    case DugiteError.NonFastForwardMergeIntoEmptyHead:
      return "您尝试的合并不是快进，因此无法在空分支上执行."
    case DugiteError.PatchDoesNotApply:
      return "请求的更改与仓库中的一个或多个文件冲突."
    case DugiteError.BranchAlreadyExists:
      return "具有该名称的分支已存在."
    case DugiteError.BadRevision:
      return "错误的修订."
    case DugiteError.NotAGitRepository:
      return "这不是git仓库."
    case DugiteError.ProtectedBranchForcePush:
      return "此分支受到强制推送操作的保护."
    case DugiteError.ProtectedBranchRequiresReview:
      return "此分支受到保护，任何更改都需要经过批准的审查。打开一个pull请求，更改的目标改为此分支."
    case DugiteError.PushWithFileSizeExceedingLimit:
      return "推送操作包括一个超过GitHub的100MB文件大小限制的文件。请从历史记录中删除该文件，然后重试."
    case DugiteError.HexBranchNameRejected:
      return "分支名称不能是由十六进制字符组成的40个字符的字符串，因为这是Git用于表示对象的格式."
    case DugiteError.ForcePushRejected:
      return "当前分支的强制推送已被拒绝."
    case DugiteError.InvalidRefLength:
      return "引用长度不能超过255个字符."
    case DugiteError.CannotMergeUnrelatedHistories:
      return "无法在此仓库中合并不相关的历史记录."
    case DugiteError.PushWithPrivateEmail:
      return 'Cannot push these commits as they contain an email address marked as private on GitHub. To push anyway, visit https://github.com/settings/emails, uncheck "Keep my email address private", then switch back to GitHub Desktop to push your commits. You can then enable the setting again.'
    case DugiteError.LFSAttributeDoesNotMatch:
      return "在全局Git配置中找到的Git LFS属性与预期值不匹配."
    case DugiteError.ProtectedBranchDeleteRejected:
      return "无法从远程仓库中删除此分支，因为它被标记为受保护."
    case DugiteError.ProtectedBranchRequiredStatus:
      return "推送被远程服务器拒绝，因为未满足所需的状态检查."
    case DugiteError.BranchRenameFailed:
      return "无法重命名分支."
    case DugiteError.PathDoesNotExist:
      return "磁盘上不存在路径."
    case DugiteError.InvalidObjectName:
      return "在Git仓库中找不到该对象."
    case DugiteError.OutsideRepository:
      return "此路径不是仓库中的有效路径."
    case DugiteError.LockFileAlreadyExists:
      return "仓库中已存在锁定文件，这将阻止此操作完成."
    case DugiteError.NoMergeToAbort:
      return "没有正在进行的合并，因此没有要中止的内容."
    case DugiteError.NoExistingRemoteBranch:
      return "远程分支不存在."
    case DugiteError.LocalChangesOverwritten:
      return "无法切换分支，因为存在将被覆盖的工作目录更改。请提交或隐藏您的更改."
    case DugiteError.UnresolvedConflicts:
      return "工作目录中存在未解决的冲突."
    case DugiteError.ConfigLockFileAlreadyExists:
      // Added in dugite 1.88.0 (https://github.com/desktop/dugite/pull/386)
      // in support of https://github.com/desktop/desktop/issues/8675 but we're
      // not using it yet. Returning a null message here means the stderr will
      // be used as the error message (or stdout if stderr is empty), i.e. the
      // same behavior as before the ConfigLockFileAlreadyExists was added
      return null
    case DugiteError.RemoteAlreadyExists:
      return null
    case DugiteError.TagAlreadyExists:
      return "具有该名称的标记已存在"
    case DugiteError.MergeWithLocalChanges:
    case DugiteError.RebaseWithLocalChanges:
    case DugiteError.GPGFailedToSignData:
    case DugiteError.ConflictModifyDeletedInBranch:
    case DugiteError.MergeCommitNoMainlineOption:
    case DugiteError.UnsafeDirectory:
    case DugiteError.PathExistsButNotInRef:
    case DugiteError.PushWithSecretDetected:
      return null
    default:
      return assertNever(error, `Unknown error: ${error}`)
  }
}

/**
 * Returns the arguments to use on any git operation that can end up
 * triggering a rebase.
 */
export function gitRebaseArguments() {
  return [
    // Explicitly set the rebase backend to merge.
    // We need to force this option to be sure that Desktop
    // uses the merge backend even if the user has the apply backend
    // configured, since this is the only one supported.
    // This can go away once git deprecates the apply backend.
    ...['-c', 'rebase.backend=merge'],
  ]
}

/**
 * Returns the SHA of the passed in IGitResult
 */
export function parseCommitSHA(result: IGitStringResult): string {
  return result.stdout.split(']')[0].split(' ')[1]
}
