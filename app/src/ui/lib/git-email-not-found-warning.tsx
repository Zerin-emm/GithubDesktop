import * as React from 'react'
import { Account, isDotComAccount } from '../../models/account'
import { LinkButton } from './link-button'
import { isAttributableEmailFor } from '../../lib/email'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { AriaLiveContainer } from '../accessibility/aria-live-container'

interface IGitEmailNotFoundWarningProps {
  /** The account the commit should be attributed to. */
  readonly accounts: ReadonlyArray<Account>

  /** The email address used in the commit author info. */
  readonly email: string
}

/**
 * A component which just displays a warning to the user if their git config
 * email doesn't match any of the emails in their GitHub (Enterprise) account.
 */
export class GitEmailNotFoundWarning extends React.Component<IGitEmailNotFoundWarningProps> {
  private buildMessage(isAttributableEmail: boolean) {
    const indicatorIcon = !isAttributableEmail ? (
      <span className="warning-icon">⚠️</span>
    ) : (
      <span className="green-circle">
        <Octicon className="check-icon" symbol={octicons.check} />
      </span>
    )

    const learnMore = !isAttributableEmail ? (
      <LinkButton
        ariaLabel="了解提交归属的更多信息"
        uri="https://docs.github.com/en/github/committing-changes-to-your-project/why-are-my-commits-linked-to-the-wrong-user"
      >
        学习更多
      </LinkButton>
    ) : null

    return (
      <>
        {indicatorIcon}
        {this.buildScreenReaderMessage(isAttributableEmail)}
        {learnMore}
      </>
    )
  }

  private buildScreenReaderMessage(isAttributableEmail: boolean) {
    const matched = isAttributableEmail ? '匹配' : '不匹配'
    const info = !isAttributableEmail ? '您的提交将被错误归属。' : ''
    return `此电子邮件地址${matched}${this.getAccountTypeDescription()}。${info}`
  }

  public render() {
    const { accounts, email } = this.props

    if (accounts.length === 0 || email.trim().length === 0) {
      return null
    }

    const isAttributableEmail = accounts.some(account =>
      isAttributableEmailFor(account, email)
    )

    /**
     * Here we put the message in the top div for visual users immediately  and
     * in the bottom div for screen readers. The screen reader content is
     * debounced to avoid frequent updates from typing in the email field.
     */
    return (
      <>
        <div className="git-email-not-found-warning">
          {this.buildMessage(isAttributableEmail)}
        </div>

        <AriaLiveContainer
          id="git-email-not-found-warning-for-screen-readers"
          trackedUserInput={this.props.email}
          message={this.buildScreenReaderMessage(isAttributableEmail)}
        />
      </>
    )
  }

  private getAccountTypeDescription() {
    if (this.props.accounts.length === 1) {
      const accountType = isDotComAccount(this.props.accounts[0])
        ? 'GitHub'
        : 'GitHub Enterprise'

      return `你的 ${accountType} 账户`
    }

    return '您的 GitHub.com 或 GitHub Enterprise 帐户中的任意一个'
  }
}
