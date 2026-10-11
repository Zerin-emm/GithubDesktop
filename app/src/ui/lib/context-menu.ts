const RestrictedFileExtensions = ['.cmd', '.exe', '.bat', '.sh']
export const CopyFilePathLabel = __DARWIN__
  ? 'Copy File Path'
  : "复制文件路径"

export const CopyRelativeFilePathLabel = __DARWIN__
  ? 'Copy Relative File Path'
  : "复制文件相对路径"

export const CopySelectedPathsLabel = __DARWIN__ ? 'Copy Paths' : "复制路径"

export const CopySelectedRelativePathsLabel = __DARWIN__
  ? 'Copy Relative Paths'
  : "复制相对路径"

export const DefaultEditorLabel = __DARWIN__
  ? 'Open in External Editor'
  : "打开于 external editor"

export const DefaultShellLabel = __DARWIN__ ? 'Open in Shell' : "打开于 shell"

export const RevealInFileManagerLabel = __DARWIN__
  ? 'Reveal in Finder'
  : __WIN32__
  ? "在资源管理器中显示"
  : 'Show in your File Manager'

export const TrashNameLabel = __WIN32__ ? "回收站" : 'Trash'

export const OpenWithDefaultProgramLabel = __DARWIN__
  ? 'Open with Default Program'
  : "使用默认程序打开"

export function isSafeFileExtension(extension: string): boolean {
  if (__WIN32__) {
    return RestrictedFileExtensions.indexOf(extension.toLowerCase()) === -1
  }
  return true
}
