import { getString, setString } from '../lib/local-storage'
import { TokenStore } from '../lib/stores/token-store'

/** The local storage key for the non-secret API settings. */
const ApiSettingsKey = 'api-settings'

/** The keytar service and account used to store the API key securely. */
const ApiKeyService = 'GitHub Desktop - Commit Message API'
const ApiKeyAccount = 'api-key'

/** The language the generated commit message should be written in. */
export type ApiMessageLanguage = 'auto' | 'zh-CN' | 'en'

/** The style the generated commit title should follow. */
export type ApiTitleStyle = 'regular' | 'conventional'

/** User-provided settings for the custom commit message API. */
export interface IApiSettings {
  /** The base URL of the API provider, e.g. https://api.openai.com */
  readonly baseUrl: string

  /** The model to request, e.g. gpt-4o-mini */
  readonly model: string

  /** The language the commit message should be written in */
  readonly language: ApiMessageLanguage

  /** The style the commit title should follow */
  readonly titleStyle: ApiTitleStyle

  /** Request timeout in seconds */
  readonly timeoutSeconds: number
}

const DefaultTimeoutSeconds = 60

function parseSettings(raw: string | null): IApiSettings | null {
  if (!raw || !raw.length) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<IApiSettings>

    if (!parsed.baseUrl || !parsed.baseUrl.trim()) {
      return null
    }

    return {
      baseUrl: parsed.baseUrl.trim().replace(/\/+$/, ''),
      model: parsed.model?.trim() ?? '',
      language: parsed.language ?? 'auto',
      titleStyle: parsed.titleStyle ?? 'regular',
      timeoutSeconds:
        typeof parsed.timeoutSeconds === 'number' && parsed.timeoutSeconds > 0
          ? parsed.timeoutSeconds
          : DefaultTimeoutSeconds,
    }
  } catch (e) {
    log.error('Failed to parse API settings from local storage', e)
    return null
  }
}

/**
 * Get the current API settings, or null when the API has not
 * been configured yet.
 */
export function getApiSettings(): IApiSettings | null {
  return parseSettings(getString(ApiSettingsKey))
}

/** Whether or not the custom commit message API has been configured. */
export function isApiConfigured(): boolean {
  return getApiSettings() !== null
}

/**
 * Persist the API settings. The API key is stored separately in the
 * system's secure credential storage (keytar).
 */
export async function saveApiSettings(
  settings: IApiSettings,
  apiKey: string
): Promise<void> {
  setString(ApiSettingsKey, JSON.stringify(settings))
  await TokenStore.setItem(ApiKeyService, ApiKeyAccount, apiKey)
}

/** Get the API key from the system's secure credential storage. */
export async function getApiKey(): Promise<string> {
  return (await TokenStore.getItem(ApiKeyService, ApiKeyAccount)) ?? ''
}
