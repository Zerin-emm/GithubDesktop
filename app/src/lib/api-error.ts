import { HttpStatusCode } from './http-status-code'

/** An error which contains additional metadata. */
export class ApiError extends Error {
  /** The error's metadata. */
  private readonly statusCode: number

  public constructor(message: string, statusCode: number) {
    super(message)

    this.name = 'ApiError'
    this.statusCode = statusCode
  }

  public get isQuotaExceededError(): boolean {
    return this.statusCode === HttpStatusCode.PaymentRequired
  }

  public get isRateLimitedError(): boolean {
    return this.statusCode === HttpStatusCode.TooManyRequests
  }
}
