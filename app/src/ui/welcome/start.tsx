import * as React from 'react'
import { WelcomeStep } from './welcome'
import { LinkButton } from '../lib/link-button'
import { Dispatcher } from '../dispatcher'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Button } from '../lib/button'
import { Loading } from '../lib/loading'
import { BrowserRedirectMessage } from '../lib/authentication-form'
import { SamplesURL } from '../../lib/stats'

/**
 * The URL to the sign-up page on GitHub.com. Used in conjunction
 * with account actions in the app where the user might want to
 * consider signing up.node vendor\yarn-1.21.1.js start
 */
export const CreateAccountURL = 'https://github.com/join?source=github-desktop'

interface IStartProps {
  readonly advance: (step: WelcomeStep) => void
  readonly dispatcher: Dispatcher
  readonly loadingBrowserAuth: boolean
}

/** The first step of the Welcome flow. */
export class Start extends React.Component<IStartProps, {}> {
  public render() {
    return (
      <section
        id="start"
        aria-label="Welcome to GitHub Desktop"
        aria-describedby="start-description"
      >
        <div className="start-content">
          <h1 className="welcome-title">
            Welcome to <span>GitHub Desktop</span>
          </h1>
          {!this.props.loadingBrowserAuth ? (
            <>
              <p id="start-description" className="welcome-text">
                GitHub Desktop 是一种无缝方式，可让您为 GitHub 和 GitHub Enterprise 上的项目做出贡献。请在下方登录，以便开始使用您的现有项目.
              </p>
            </>
          ) : (
            <p>{BrowserRedirectMessage}</p>
          )}

          <div className="welcome-main-buttons">
            <Button
              type="submit"
              className="button-with-icon"
              disabled={this.props.loadingBrowserAuth}
              onClick={this.signInWithBrowser}
              autoFocus={true}
              role="link"
            >
              {this.props.loadingBrowserAuth && <Loading />}
              GitHub登录
              <Octicon symbol={octicons.linkExternal} />
            </Button>
            {this.props.loadingBrowserAuth ? (
              <Button onClick={this.cancelBrowserAuth}>取消</Button>
            ) : (
              <Button onClick={this.signInToEnterprise}>
                Github企业版登录
              </Button>
            )}
          </div>
          <div className="skip-action-container">
            <p className="welcome-text">
              第一次使用Github？{' '}
              <LinkButton
                uri={CreateAccountURL}
                className="create-account-link"
              >
                创建账户
              </LinkButton>
            </p>
            <LinkButton className="skip-button" onClick={this.skip}>
              跳过
            </LinkButton>
          </div>
        </div>

        <div className="start-footer">
          <p>
            创建账户，代表您同意{' '}
            <LinkButton uri={'https://github.com/site/terms'}>
              服务条款
            </LinkButton>
            . 更多信息，请参阅{' '}
            <LinkButton uri={'https://github.com/site/privacy'}>
              GitHub 隐私声明.
            </LinkButton>
          </p>
          <p>
            GitHub Desktop 会发送使用数据以改进产品并提供功能决策参考.{' '}
            <LinkButton uri={SamplesURL}>
              了解更多关于用户数据的信息.
            </LinkButton>
          </p>
        </div>
      </section>
    )
  }

  private signInWithBrowser = (event?: React.MouseEvent<HTMLButtonElement>) => {
    if (event) {
      event.preventDefault()
    }

    this.props.advance(WelcomeStep.SignInToDotComWithBrowser)
    this.props.dispatcher.requestBrowserAuthenticationToDotcom()
  }

  private cancelBrowserAuth = () => {
    this.props.advance(WelcomeStep.Start)
  }

  private signInToEnterprise = () => {
    this.props.advance(WelcomeStep.SignInToEnterprise)
  }

  private skip = () => {
    this.props.advance(WelcomeStep.ConfigureGit)
  }
}
