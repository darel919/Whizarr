export type Config = {
  port: number
  localAiBaseUrl: string
  localAiModel: string
  localAiTranslationModel?: string
  localAiApiKey?: string
  connectTimeoutMs: number
  transcriptionTimeoutMs: number
  detectionSeconds: number
  maxConcurrentTranscriptions: number
  maxAudioUploadBytes: number
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  logFullVideoPath: boolean
}

function positiveInt(name: string, value: string | undefined, fallback: number) {
  const parsed = Number(value ?? fallback)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`)
  return parsed
}

function bool(name: string, value: string | undefined, fallback: boolean) {
  if (value === undefined || value === '') return fallback
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error(`${name} must be true or false`)
}

export function loadConfig(env: Record<string, string | undefined> = Bun.env): Config {
  const localAiBaseUrl = env.LOCALAI_BASE_URL?.trim()
  const localAiModel = env.LOCALAI_MODEL?.trim()
  if (!localAiBaseUrl) throw new Error('LOCALAI_BASE_URL is required')
  if (!localAiModel) throw new Error('LOCALAI_MODEL is required')

  let url: URL
  try { url = new URL(localAiBaseUrl) } catch { throw new Error('LOCALAI_BASE_URL must be a valid URL') }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('LOCALAI_BASE_URL must use http or https')

  const logLevel = env.LOG_LEVEL || 'info'
  if (!['debug', 'info', 'warn', 'error'].includes(logLevel)) throw new Error('LOG_LEVEL must be debug, info, warn, or error')

  return {
    port: positiveInt('PORT', env.PORT, 9000),
    localAiBaseUrl: localAiBaseUrl.replace(/\/+$/, ''),
    localAiModel,
    localAiTranslationModel: env.LOCALAI_TRANSLATION_MODEL?.trim() || undefined,
    localAiApiKey: env.LOCALAI_API_KEY?.trim() || undefined,
    connectTimeoutMs: positiveInt('LOCALAI_CONNECT_TIMEOUT_MS', env.LOCALAI_CONNECT_TIMEOUT_MS, 10_000),
    transcriptionTimeoutMs: positiveInt('LOCALAI_TRANSCRIPTION_TIMEOUT_MS', env.LOCALAI_TRANSCRIPTION_TIMEOUT_MS, 3_600_000),
    detectionSeconds: positiveInt('LANGUAGE_DETECTION_SECONDS', env.LANGUAGE_DETECTION_SECONDS, 30),
    maxConcurrentTranscriptions: positiveInt('MAX_CONCURRENT_TRANSCRIPTIONS', env.MAX_CONCURRENT_TRANSCRIPTIONS, 1),
    maxAudioUploadBytes: positiveInt('MAX_AUDIO_UPLOAD_MB', env.MAX_AUDIO_UPLOAD_MB, 1024) * 1024 * 1024,
    logLevel: logLevel as Config['logLevel'],
    logFullVideoPath: bool('LOG_FULL_VIDEO_PATH', env.LOG_FULL_VIDEO_PATH, false),
  }
}
