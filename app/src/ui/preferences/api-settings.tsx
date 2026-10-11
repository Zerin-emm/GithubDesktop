import * as React from 'react'

import { Button } from '../lib/button'
import { TextBox } from '../lib/text-box'
import { Row } from '../lib/row'
import { Select } from '../lib/select'
import { DialogContent } from '../dialog'
import {
  getApiSettings,
  getApiKey,
  saveApiSettings,
  IApiSettings,
  ApiMessageLanguage,
  ApiTitleStyle,
} from '../../models/api-settings'
import { testApiConnection } from '../../lib/api'

interface IApiSettingsState {
  readonly baseUrl: string
  readonly model: string
  readonly apiKey: string
  readonly language: ApiMessageLanguage
  readonly titleStyle: ApiTitleStyle
  readonly timeoutSeconds: string
  readonly testing: boolean
  readonly testResult: string | null
  readonly testOk: boolean
}

export class ApiSettings extends React.Component<{}, IApiSettingsState> {
  public constructor(props: {}) {
    super(props)

    const settings = getApiSettings()

    this.state = {
      baseUrl: settings?.baseUrl ?? '',
      model: settings?.model ?? '',
      apiKey: '',
      language: settings?.language ?? 'auto',
      titleStyle: settings?.titleStyle ?? 'regular',
      timeoutSeconds: String(settings?.timeoutSeconds ?? 60),
      testing: false,
      testResult: null,
      testOk: false,
    }

    void this.loadApiKey()
  }

  private async loadApiKey() {
    const apiKey = await getApiKey()
    if (apiKey) {
      this.setState({ apiKey })
    }
  }

  private buildSettings(): IApiSettings {
    return {
      baseUrl: this.state.baseUrl,
      model: this.state.model,
      language: this.state.language,
      titleStyle: this.state.titleStyle,
      timeoutSeconds: Math.max(1, parseInt(this.state.timeoutSeconds, 10) || 60),
    }
  }

  private onTestConnection = async () => {
    if (!this.state.baseUrl) {
      this.setState({ testResult: '请先填写 API 地址。', testOk: false })
      return
    }

    this.setState({ testing: true, testResult: null })

    const result = await testApiConnection(
      this.buildSettings(),
      this.state.apiKey
    )

    this.setState({
      testing: false,
      testResult: result.message,
      testOk: result.ok,
    })
  }

  private onSave = async () => {
    await saveApiSettings(this.buildSettings(), this.state.apiKey)
    this.setState({ testResult: '设置已保存。', testOk: true })
  }

  public render() {
    return (
      <DialogContent>
        <Row>
          <TextBox
            label="API 地址(Base URL)"
            placeholder="例如 https://api.openai.com 或 http://localhost:11434"
            value={this.state.baseUrl}
            onValueChanged={value => this.setState({ baseUrl: value })}
          />
        </Row>
        <Row>
          <TextBox
            label="API Key(本地模型可留空)"
            type="password"
            value={this.state.apiKey}
            onValueChanged={value => this.setState({ apiKey: value })}
          />
        </Row>
        <Row>
          <TextBox
            label="模型名称"
            placeholder="例如 gpt-4o-mini、qwen-plus、llama3"
            value={this.state.model}
            onValueChanged={value => this.setState({ model: value })}
          />
        </Row>
        <Row>
          <Select
            label="生成语言"
            value={this.state.language}
            onChange={e =>
              this.setState({
                language: (e.target as HTMLSelectElement).value as ApiMessageLanguage,
              })
            }
          >
            <option value="auto">跟随 diff 内容的主要语言</option>
            <option value="zh-CN">简体中文</option>
            <option value="en">English</option>
          </Select>
        </Row>
        <Row>
          <Select
            label="提交标题格式"
            value={this.state.titleStyle}
            onChange={e =>
              this.setState({
                titleStyle: (e.target as HTMLSelectElement).value as ApiTitleStyle,
              })
            }
          >
            <option value="regular">直接概括变更</option>
            <option value="conventional">Conventional Commits(feat: 等)</option>
          </Select>
        </Row>
        <Row>
          <TextBox
            label="请求超时(秒)"
            value={this.state.timeoutSeconds}
            onValueChanged={value => this.setState({ timeoutSeconds: value })}
          />
        </Row>
        <p
          className="description"
          style={{
            minHeight: '24px',
            margin: 0,
            color: this.state.testOk ? 'inherit' : 'var(--error-color)',
            visibility: this.state.testResult === null ? 'hidden' : 'visible',
          }}
        >
          {this.state.testResult ?? ''}
        </p>
        <Row>
          <Button onClick={this.onTestConnection} disabled={this.state.testing}>
            {this.state.testing ? '正在测试…' : '测试连接'}
          </Button>
          <Button onClick={this.onSave} disabled={this.state.testing}>
            保存设置
          </Button>
        </Row>
        <p className="description">
          API 地址填写到版本号之前即可,请求时会自动拼接
          /v1/chat/completions。API Key 保存在系统凭据管理器中。
        </p>
      </DialogContent>
    )
  }
}
