import * as React from 'react'
import { DialogContent } from '../dialog'
import { TextArea } from '../lib/text-area'
import { LinkButton } from '../lib/link-button'
import { Ref } from '../lib/ref'

interface IGitIgnoreProps {
  readonly text: string | null
  readonly onIgnoreTextChanged: (text: string) => void
  readonly onShowExamples: () => void
}

/** A view for creating or modifying the repository's gitignore file */
export class GitIgnore extends React.Component<IGitIgnoreProps, {}> {
  public render() {
    return (
      <DialogContent>
        <p id="ignored-files-description">
          Editing <Ref>.gitignore</Ref>. 文件，该文件指定Git应该忽略的故意未跟踪的文件，Git已经跟踪的文件不受影响.{' '}
          <LinkButton onClick={this.props.onShowExamples}>
            了解有关gitignore文件的更多信息
          </LinkButton>
        </p>

        <TextArea
          ariaLabel="忽略文件"
          ariaDescribedBy="ignored-files-description"
          placeholder="忽略文件"
          value={this.props.text || ''}
          onValueChanged={this.props.onIgnoreTextChanged}
          textareaClassName="gitignore"
        />
      </DialogContent>
    )
  }
}
