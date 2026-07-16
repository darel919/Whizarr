import { createApp } from './app'
import { loadConfig } from './config'

const config = loadConfig()
const app = createApp(config).listen({ port: config.port, hostname: '0.0.0.0' })

console.log(JSON.stringify({
  level: 'info', event: 'proxy_started', port: config.port,
  localAiBaseUrl: config.localAiBaseUrl, model: config.localAiModel,
  translation: config.localAiTranslationModel ? 'openai-translations-endpoint' : 'disabled',
}))

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => { app.stop(); process.exit(0) })
}
