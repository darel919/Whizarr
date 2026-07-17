import type { Config } from '../config'
import { ApiError } from '../errors/api-error'

type AudioRequest = {
  file: File
  format: 'srt' | 'verbose_json'
  model?: string
  language?: string
  prompt?: string
  translation?: boolean
  timeoutMs?: number
}

export class LocalAiClient {
  private fetcher: typeof fetch

  constructor(private config: Config, fetcher?: typeof fetch) {
    if (fetcher) {
      this.fetcher = fetcher
      return
    }
    // ASR audio is split into bounded chunks before reaching this client.
    // Bun's native fetch interoperates reliably with LocalAI's chunked HTTP
    // responses; the standalone Undici dispatcher could remain pending even
    // after LocalAI logged a successful HTTP 200 response.
    this.fetcher = globalThis.fetch
  }

  private headers() {
    return this.config.localAiApiKey ? { Authorization: `Bearer ${this.config.localAiApiKey}` } : undefined
  }

  async audio(request: AudioRequest): Promise<Response> {
    const form = new FormData()
    form.append('file', request.file)
    form.append('model', request.model || this.config.localAiModel)
    form.append('response_format', request.format)
    if (request.language) form.append('language', request.language)
    if (request.prompt) form.append('prompt', request.prompt)
    const route = request.translation ? 'translations' : 'transcriptions'
    const timeoutMs = request.timeoutMs ?? this.config.transcriptionTimeoutMs
    const controller = new AbortController()
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort(new DOMException('LocalAI request timed out', 'TimeoutError'))
    }, timeoutMs)

    try {
      const response = await this.fetcher(`${this.config.localAiBaseUrl}/v1/audio/${route}`, {
        method: 'POST', headers: this.headers(), body: form,
        signal: controller.signal,
        keepalive: false,
      })
      // Buffer the complete upstream response while the abort timer is still
      // active. Previously the timer was cleared after headers, allowing a
      // stalled response body to leave an ASR chunk waiting indefinitely.
      const body = await response.arrayBuffer()
      if (!response.ok) {
        const details = new TextDecoder().decode(body).slice(0, 1000)
        if (response.status === 413) {
          throw new ApiError(
            502,
            'LocalAI rejected the audio upload (HTTP 413); increase LOCALAI_UPLOAD_LIMIT on the LocalAI service',
            details,
          )
        }
        throw new ApiError(502, `LocalAI returned HTTP ${response.status}`, details)
      }
      return new Response(body, { status: response.status, headers: response.headers })
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (timedOut || controller.signal.aborted) {
        throw new ApiError(504, 'LocalAI request timed out')
      }
      const details = error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error)
      throw new ApiError(502, 'LocalAI connection closed before inference completed', details)
    } finally {
      clearTimeout(timeout)
    }
  }

  async health() {
    try {
      const response = await this.fetcher(`${this.config.localAiBaseUrl}/v1/models`, {
        headers: this.headers(), signal: AbortSignal.timeout(this.config.connectTimeoutMs),
      })
      if (!response.ok) return { reachable: true, modelAvailable: false }
      const body = await response.json() as { data?: Array<{ id?: string }> }
      return { reachable: true, modelAvailable: body.data?.some((model) => model.id === this.config.localAiModel) ?? false }
    } catch { return { reachable: false, modelAvailable: false } }
  }
}
