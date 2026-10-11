import * as React from 'react'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { Form } from './form'
import { Button } from './button'

/** Text to let the user know their browser will send them back to GH Desktop */
export const BrowserRedirectMessage =
  "登录后，浏览器将会重定向到GitHub Desktop。如果您的浏览器请求您允许启动GitHub Desktop，请点击允许。"

interface IAuthenticationFormProps {
  /**
   * A callback which is invoked if the user requests OAuth sign in using
   * their system configured browser.
   */
  readonly onBrowserSignInRequested: () => void

  /**
   * An array of additional buttons to render after the "Sign In" button.
   * (Usually, a 'cancel' button)
   */
  readonly additionalButtons?: ReadonlyArray<JSX.Element>
}

/** The GitHub authentication component. */
export class AuthenticationForm extends React.Component<IAuthenticationFormProps> {
  public render() {
    return (
      <Form className="sign-in-form" onSubmit={this.signInWithBrowser}>
        {this.renderEndpointRequiresWebFlow()}
      </Form>
    )
  }

  /**
   * Show a message informing the user they must sign in via the web flow
   * and a button to do so
   */
  private renderEndpointRequiresWebFlow() {
    return (
      <>
        {BrowserRedirectMessage}
        <Button
          type="submit"
          className="button-with-icon"
          onClick={this.signInWithBrowser}
          autoFocus={true}
          role="link"
        >
          使用浏览器登录
          <Octicon symbol={octicons.linkExternal} />
        </Button>
        {this.props.additionalButtons}
      </>
    )
  }

  private signInWithBrowser = (event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault()
    this.props.onBrowserSignInRequested()
  }
}
