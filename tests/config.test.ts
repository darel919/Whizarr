import { expect, test } from 'bun:test'
import { loadConfig } from '../src/config'

test('normalizes configuration and defaults', () => {
  const config = loadConfig({ LOCALAI_BASE_URL: 'http://localai.test///', LOCALAI_MODEL: 'whisper-1' })
  expect(config.localAiBaseUrl).toBe('http://localai.test')
  expect(config.port).toBe(9000)
  expect(config.transcriptionTimeoutMs).toBe(3_600_000)
})

test('fails fast when required configuration is absent', () => {
  expect(() => loadConfig({})).toThrow('LOCALAI_BASE_URL is required')
})
