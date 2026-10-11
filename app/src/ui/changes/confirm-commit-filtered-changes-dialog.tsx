import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { Row } from '../lib/row'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { LinkButton } from '../lib/link-button'

interface IConfirmCommitFilteredChangesProps {
  readonly onCommitAnyway: () => void
  readonly onDismissed: () => void
  readonly showFilesToBeCommitted: () => void
  readonly setConfirmCommitFilteredChanges: (value: boolean) => void
}

interface IConfirmCommitFilteredChangesState {
  readonly askForConfirmationOnCommitFilteredChanges: boolean
}

export class ConfirmCommitFilteredChanges extends React.Component<
  IConfirmCommitFilteredChangesProps,
  IConfirmCommitFilteredChangesState
> {
  public constructor(props: IConfirmCommitFilteredChangesProps) {
    super(props)

    this.state = {
      askForConfirmationOnCommitFilteredChanges: true,
    }
  }

  public render() {
    return (
      <Dialog
        id="hidden-changes"
        type="warning"
        title={
          __DARWIN__ ? "提交筛选后的更改?" : "提交筛选后的更改?"
        }
        onSubmit={this.onSubmit}
        onDismissed={this.props.onDismissed}
        role="alertdialog"
        ariaDescribedBy="confirm-commit-filtered-changes-message"
      >
        <DialogContent>
          <p id="confirm-commit-filtered-changes-message">
            当前启用了筛选,有{' '}
            <LinkButton onClick={this.showFilesToBeCommitted}>
              隐藏的更改
            </LinkButton>{' '}
            将被提交。确定要提交这些更改吗?
          </p>
          <Row>
            <Checkbox
              label="不再显示此消息"
              value={
                this.state.askForConfirmationOnCommitFilteredChanges
                  ? CheckboxValue.Off
                  : CheckboxValue.On
              }
              onChange={this.onShowMessageChange}
            />
          </Row>
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            destructive={true}
            okButtonText={__DARWIN__ ? "仍然提交" : "仍然提交"}
            cancelButtonText={"取消"}
            onCancelButtonClick={this.props.onDismissed}
          />
        </DialogFooter>
      </Dialog>
    )
  }

  private onShowMessageChange = (event: React.FormEvent<HTMLInputElement>) => {
    const value = !event.currentTarget.checked

    this.setState({ askForConfirmationOnCommitFilteredChanges: value })
  }

  private showFilesToBeCommitted = () => {
    this.props.showFilesToBeCommitted()
    this.props.onDismissed()
  }

  private onSubmit = () => {
    this.props.setConfirmCommitFilteredChanges(
      this.state.askForConfirmationOnCommitFilteredChanges
    )
    this.props.onCommitAnyway()
    this.props.onDismissed()
  }
}
