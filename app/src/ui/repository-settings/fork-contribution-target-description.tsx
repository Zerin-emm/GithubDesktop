import * as React from 'react'
import { ForkContributionTarget } from '../../models/workflow-preferences'
import { RepositoryWithForkedGitHubRepository } from '../../models/repository'

interface IForkSettingsDescription {
  readonly repository: RepositoryWithForkedGitHubRepository
  readonly forkContributionTarget: ForkContributionTarget
}

export function ForkSettingsDescription(props: IForkSettingsDescription) {
  // We can't use the getNonForkGitHubRepository() helper since we need to calculate
  // the value based on the temporary form state.
  const targetRepository =
    props.forkContributionTarget === ForkContributionTarget.Self
      ? props.repository.gitHubRepository
      : props.repository.gitHubRepository.parent

  return (
    <ul className="fork-settings-description">
      <li>
        目标为 <strong>{targetRepository.fullName}</strong>{' '}
        的拉取请求将显示在拉取请求列表中。
      </li>
      <li>
        Issue 将创建在 <strong>{targetRepository.fullName}</strong> 中。
      </li>
      <li>
        "在 GitHub 上查看"将在浏览器中打开{' '}
        <strong>{targetRepository.fullName}</strong>。
      </li>
      <li>
        新分支将基于 <strong>{targetRepository.fullName}</strong>{' '}
        的默认分支创建。
      </li>
      <li>
        用户和 Issue 的自动补全将基于{' '}
        <strong>{targetRepository.fullName}</strong>。
      </li>
    </ul>
  )
}
