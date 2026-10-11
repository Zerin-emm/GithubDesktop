import { IMenuItem } from '../../lib/menu-item'

interface IPullRequestContextMenuConfig {
  onViewPullRequestOnGitHub?: () => void
}

export function generatePullRequestContextMenuItems(
  config: IPullRequestContextMenuConfig
): IMenuItem[] {
  const { onViewPullRequestOnGitHub } = config
  const items = new Array<IMenuItem>()

  if (onViewPullRequestOnGitHub !== undefined) {
    items.push({
      label: "在 GitHub 上查看 Pull Request",
      action: () => onViewPullRequestOnGitHub(),
    })
  }

  return items
}
