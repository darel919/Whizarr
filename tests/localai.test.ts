import { expect, test } from 'bun:test'
import { LocalAiClient } from '../src/services/localai'
import { testConfig } from './helpers'

test('uses the configured transcription timeout without a five-minute cap', async () => {
  let signal: AbortSignal | undefined
  const fetcher = async (_request: RequestInfo | URL, init?: RequestInit) => {
    signal = init?.signal || undefined
    return new Response('1\n00:00:00,000 --> 00:00:01,000\nHello\n')
  }
  const client = new LocalAiClient({ ...testConfig, transcriptionTimeoutMs: 14_400_000 }, fetcher as typeof fetch)
  await client.audio({ file: new File(['audio'], 'audio.wav'), format: 'srt' })
  expect(signal?.aborted).toBeFalse()
})

test('reports only its own timer as a LocalAI timeout', async () => {
  const fetcher = async (_request: RequestInfo | URL, init?: RequestInit) => {
    await new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)))
    return new Response()
  }
  const client = new LocalAiClient({ ...testConfig, transcriptionTimeoutMs: 5 }, fetcher as typeof fetch)
  await expect(client.audio({ file: new File(['audio'], 'audio.wav'), format: 'srt' })).rejects.toMatchObject({
    status: 504,
    message: 'LocalAI request timed out',
  })
})
