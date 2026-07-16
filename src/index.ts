import { createApp } from './app'
import { loadConfig } from './config'

const config = loadConfig()
// Whisper inference can legitimately take many minutes. Bun's default HTTP idle
// timeout would otherwise close the Bazarr connection while LocalAI keeps working.
const app = createApp(config).listen({
  port: config.port,
  hostname: '0.0.0.0',
  idleTimeout: 0,
  // Bun rejects large bodies before Elysia route/error handling runs unless its
  // server-level limit is raised too. Leave room for multipart boundaries.
  maxRequestBodySize: config.maxAudioUploadBytes + 1024 * 1024,
})

console.log(JSON.stringify({
  level: 'info', event: 'proxy_started', port: config.port,
  localAiBaseUrl: config.localAiBaseUrl, model: config.localAiModel,
  translation: config.localAiTranslationModel ? 'openai-translations-endpoint' : 'disabled',
  maxAudioUploadMb: config.maxAudioUploadBytes / 1024 / 1024,
  transcriptionTimeoutMs: config.transcriptionTimeoutMs,
  maxConcurrentTranscriptions: config.maxConcurrentTranscriptions,
}))

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => { app.stop(); process.exit(0) })
}
