import { basename } from 'node:path'
import { Elysia } from 'elysia'
import packageJson from '../package.json'
import { chunkRawPcm, normalizeAudio, normalizeDetectionAudio } from './audio/normalize'
import { PCM_BITS_PER_SAMPLE, PCM_CHANNELS, PCM_SAMPLE_RATE } from './audio/wav'
import { Semaphore } from './concurrency'
import type { Config } from './config'
import { ApiError } from './errors/api-error'
import { detectTranscriptLanguage } from './language/detect-text'
import { extractLanguage, summarizeLanguagePayload } from './language/names'
import { createLogger } from './logger'
import { LocalAiClient } from './services/localai'
import { offsetAndRenumberSrt } from './subtitles/srt'

type Dependencies = { fetcher?: typeof fetch }
const srtPattern = /^\s*\d+\s*\r?\n\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}/m

function audioFile(body: unknown): File {
  const value = (body as { audio_file?: unknown } | undefined)?.audio_file
  if (!(value instanceof File)) throw new ApiError(400, 'Missing multipart audio_file')
  if (value.size === 0) throw new ApiError(400, 'audio_file is empty')
  return value
}

export function createApp(config: Config, dependencies: Dependencies = {}) {
  const localAi = new LocalAiClient(config, dependencies.fetcher)
  const semaphore = new Semaphore(config.maxConcurrentTranscriptions)
  const log = createLogger(config)

  return new Elysia()
    .onRequest(({ request }) => {
      const url = new URL(request.url)
      if (request.method === 'POST' && ['/asr', '/detect-language'].includes(url.pathname)) {
        log('info', 'request_received', {
          route: url.pathname,
          contentLength: Number(request.headers.get('content-length')) || undefined,
        })
      }
    })
    .onError(({ error, set }) => {
      const apiError = error instanceof ApiError ? error : new ApiError(500, 'Internal server error')
      set.status = apiError.status
      if (!(error instanceof ApiError)) log('error', 'unhandled_error', { error: error instanceof Error ? error.message : String(error) })
      return { error: apiError.message }
    })
    .get('/status', () => ({ version: `bazarr-localai-proxy ${packageJson.version}` }))
    .get('/health', async ({ set }) => {
      const health = await localAi.health()
      if (!health.reachable || !health.modelAvailable) set.status = 503
      return {
        status: health.reachable && health.modelAvailable ? 'ok' : 'degraded',
        localai: health.reachable ? 'reachable' : 'unreachable',
        model: health.modelAvailable ? 'available' : 'unavailable',
      }
    })
    .post('/asr', async ({ body, query, set }) => {
      const started = performance.now()
      const requestId = crypto.randomUUID()
      const task = query.task || 'transcribe'
      const output = query.output || 'srt'
      if (!['transcribe', 'translate'].includes(task)) throw new ApiError(400, `Unsupported task: ${task}`)
      if (output !== 'srt') throw new ApiError(400, `Unsupported output: ${output}`)
      if (query.language && !/^[a-zA-Z]{2}(?:[-_][a-zA-Z]{2})?$/.test(query.language)) throw new ApiError(400, 'Invalid language hint')
      const file = audioFile(body)
      if (file.size > config.maxAudioUploadBytes) throw new ApiError(413, 'audio_file exceeds MAX_AUDIO_UPLOAD_MB')
      if (task === 'translate' && !config.localAiTranslationModel) {
        throw new ApiError(501, 'Whisper translation is not supported unless LOCALAI_TRANSLATION_MODEL is configured')
      }
      const video = query.video_file
        ? (config.logFullVideoPath ? query.video_file : basename(query.video_file)) : undefined
      log('info', 'asr_started', { requestId, route: '/asr', task, language: query.language, audioBytes: file.size, video, model: task === 'translate' ? config.localAiTranslationModel : config.localAiModel, timeoutMs: config.transcriptionTimeoutMs })
      try {
        const bytesPerSecond = PCM_SAMPLE_RATE * PCM_CHANNELS * (PCM_BITS_PER_SAMPLE / 8)
        const rawChunks = await chunkRawPcm(file, query.encode, bytesPerSecond * config.asrChunkSeconds)
        const chunks = rawChunks || [{ file: await normalizeAudio(file, query.encode), offsetBytes: 0, pcmBytes: file.size }]
        const srt = await semaphore.run(async () => {
          const output: string[] = []
          let nextIndex = 1
          for (let index = 0; index < chunks.length; index++) {
            const chunk = chunks[index]
            log('info', 'asr_chunk_started', {
              requestId, chunk: index + 1, chunks: chunks.length,
              offsetSeconds: Math.round(chunk.offsetBytes / bytesPerSecond),
              audioBytes: chunk.pcmBytes,
            })
            const chunkStarted = performance.now()
            const response = await localAi.audio({
              file: chunk.file, format: 'srt', language: query.language,
              prompt: query.initial_prompt, translation: task === 'translate',
              model: task === 'translate' ? config.localAiTranslationModel : undefined,
            })
            const chunkSrt = await response.text()
            if (!srtPattern.test(chunkSrt)) throw new ApiError(502, `LocalAI returned invalid SRT output for chunk ${index + 1}`)
            const adjusted = offsetAndRenumberSrt(
              chunkSrt,
              Math.round(chunk.offsetBytes / bytesPerSecond * 1000),
              nextIndex,
            )
            output.push(adjusted.srt)
            nextIndex = adjusted.nextIndex
            log('info', 'asr_chunk_completed', {
              requestId, chunk: index + 1, chunks: chunks.length,
              durationMs: Math.round(performance.now() - chunkStarted),
            })
          }
          return `${output.join('\n\n')}\n`
        })
        set.headers['content-type'] = 'text/plain; charset=utf-8'
        log('info', 'asr_completed', { requestId, status: 200, chunks: chunks.length, durationMs: Math.round(performance.now() - started) })
        return srt
      } catch (error) {
        log('error', 'asr_failed', {
          requestId,
          status: error instanceof ApiError ? error.status : 500,
          durationMs: Math.round(performance.now() - started),
          error: error instanceof Error ? error.message : String(error),
          upstreamDetails: error instanceof ApiError ? error.details : undefined,
        })
        throw error
      }
    })
    .post('/detect-language', async ({ body, query }) => {
      const started = performance.now()
      const requestId = crypto.randomUUID()
      const file = audioFile(body)
      if (file.size > config.maxAudioUploadBytes) throw new ApiError(413, 'audio_file exceeds MAX_AUDIO_UPLOAD_MB')
      const bytesPerSecond = PCM_SAMPLE_RATE * PCM_CHANNELS * (PCM_BITS_PER_SAMPLE / 8)
      try {
        const detect = async (seconds: number) => {
          const normalized = await normalizeDetectionAudio(file, query.encode, bytesPerSecond * seconds)
          const response = await semaphore.run(() => localAi.audio({
            file: normalized, format: 'verbose_json', timeoutMs: Math.min(config.transcriptionTimeoutMs, 300_000),
          }))
          let payload: unknown
          try { payload = await response.json() } catch { throw new ApiError(502, 'LocalAI returned invalid language detection JSON') }
          return { payload, sampleBytes: normalized.size - (query.encode === 'true' ? 0 : 44) }
        }

        log('info', 'detection_started', { requestId, route: '/detect-language', audioBytes: file.size, sampleBytes: bytesPerSecond * config.detectionSeconds, sampleStrategy: 'distributed-3-window', model: config.localAiModel })
        let { payload } = await detect(config.detectionSeconds)
        let language = extractLanguage(payload)
        let detectionSource = 'localai'
        let confidence: number | undefined
        if (!language) {
          const fallback = detectTranscriptLanguage(payload)
          language = fallback?.language
          confidence = fallback?.confidence
          detectionSource = 'transcript-text'
        }
        if (!language) {
          const retrySeconds = config.detectionSeconds * 2
          log('info', 'detection_retry', {
            requestId,
            reason: 'insufficient-confident-transcript',
            detectionSeconds: retrySeconds,
            sampleStrategy: 'distributed-3-window',
          })
          ;({ payload } = await detect(retrySeconds))
          language = extractLanguage(payload)
          detectionSource = 'localai-retry'
          if (!language) {
            const fallback = detectTranscriptLanguage(payload)
            language = fallback?.language
            confidence = fallback?.confidence
            detectionSource = 'transcript-text-retry'
          }
        }
        if (!language) {
          throw new ApiError(
            502,
            'LocalAI did not return a valid ISO-639-1 language',
            JSON.stringify(summarizeLanguagePayload(payload)),
          )
        }
        log('info', 'detection_completed', {
          requestId, status: 200, language: language.language_code,
          detectionSource, confidence,
          durationMs: Math.round(performance.now() - started),
        })
        return language
      } catch (error) {
        log('error', 'detection_failed', {
          requestId,
          status: error instanceof ApiError ? error.status : 500,
          durationMs: Math.round(performance.now() - started),
          error: error instanceof Error ? error.message : String(error),
          upstreamDetails: error instanceof ApiError ? error.details : undefined,
        })
        throw error
      }
    })
}
