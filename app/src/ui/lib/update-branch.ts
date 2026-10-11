import { getCommitsBetweenCommits } from '../../lib/git'
import { promiseWithMinimumTimeout } from '../../lib/promise'
import { Branch } from '../../models/branch'
import { ComputedAction } from '../../models/computed-action'
import { MultiCommitOperationKind } from '../../models/multi-commit-operation'
import { RebasePreview } from '../../models/rebase'
import { Repository } from '../../models/repository'
import { IDropdownSelectButtonOption } from '../dropdown-select-button'

export function getMergeOptions(): ReadonlyArray<IDropdownSelectButtonOption> {
  return [
    {
      label: "创建合并提交",
      description:
        "来自所选分支的提交将通过合并提交添加到当前分支.",
      id: MultiCommitOperationKind.Merge,
    },
    {
      label: "压缩合并",
      description:
        "选定分支中的提交将合并为当前分支中的一个提交.",
      id: MultiCommitOperationKind.Squash,
    },
    {
      label: "变基",
      description:
        "来自所选分支的提交将重新设置基础并添加到当前分支.",
      id: MultiCommitOperationKind.Rebase,
    },
  ]
}

export async function updateRebasePreview(
  baseBranch: Branch,
  targetBranch: Branch,
  repository: Repository,
  onUpdate: (rebasePreview: RebasePreview | null) => void
) {
  const computingRebaseForBranch = baseBranch.name

  onUpdate({
    kind: ComputedAction.Loading,
  })

  const commitsBehind = await promiseWithMinimumTimeout(
    () =>
      getCommitsBetweenCommits(
        repository,
        targetBranch.tip.sha,
        baseBranch.tip.sha
      ),
    500
  )

  const commitsAhead = await promiseWithMinimumTimeout(
    () =>
      getCommitsBetweenCommits(
        repository,
        baseBranch.tip.sha,
        targetBranch.tip.sha
      ),
    500
  )

  // if the branch being track has changed since we started this work, abandon
  // any further state updates (this function is re-entrant if the user is
  // using the keyboard to quickly switch branches)
  if (computingRebaseForBranch !== baseBranch.name) {
    onUpdate(null)
    return
  }

  // if we are unable to find any commits to rebase, indicate that we're
  // unable to proceed with the rebase
  if (commitsBehind === null) {
    onUpdate({
      kind: ComputedAction.Invalid,
    })
    return
  }

  onUpdate({
    kind: ComputedAction.Clean,
    commitsAhead: commitsAhead ?? [],
    commitsBehind: commitsBehind,
  })
}
