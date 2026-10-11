import * as React from 'react'
import { DialogContent } from '../dialog'
import { ForkContributionTarget } from '../../models/workflow-preferences'
import { RepositoryWithForkedGitHubRepository } from '../../models/repository'
import { ForkSettingsDescription } from './fork-contribution-target-description'
import { RadioGroup } from '../lib/radio-group'
import { assertNever } from '../../lib/fatal-error'

interface IForkSettingsProps {
  readonly forkContributionTarget: ForkContributionTarget
  readonly repository: RepositoryWithForkedGitHubRepository
  readonly onForkContributionTargetChanged: (
    forkContributionTarget: ForkContributionTarget
  ) => void
}

/** A view for creating or modifying the repository's gitignore file */
export class ForkSettings extends React.Component<IForkSettingsProps, {}> {
  private renderForkOptionsLabel = (key: ForkContributionTarget) => {
    switch (key) {
      case ForkContributionTarget.Parent:
        return '为父存储库做出贡献'
      case ForkContributionTarget.Self:
        return "出于自己的目的"
      default:
        return assertNever(key, `Unknown fork contribution target: ${key}`)
    }
  }

  public render() {
    const options = [ForkContributionTarget.Parent, ForkContributionTarget.Self]
    const selectionOption =
      options.find(o => o === this.props.forkContributionTarget) ??
      ForkContributionTarget.Parent

    return (
      <DialogContent>
        <h2 id="fork-usage-heading">使用这个 fork…</h2>

        <RadioGroup<ForkContributionTarget>
          ariaLabelledBy="fork-usage-heading"
          selectedKey={selectionOption}
          radioButtonKeys={options}
          onSelectionChanged={this.onForkContributionTargetChanged}
          renderRadioButtonLabelContents={this.renderForkOptionsLabel}
        />

        <ForkSettingsDescription
          repository={this.props.repository}
          forkContributionTarget={this.props.forkContributionTarget}
        />
      </DialogContent>
    )
  }

  private onForkContributionTargetChanged = (value: ForkContributionTarget) => {
    this.props.onForkContributionTargetChanged(value)
  }
}
