import { describe, expect, test } from 'bun:test'
import { createApp } from '../src/app'
import { testConfig, upload } from './helpers'

describe('proxy routes', () => {
  test('status exposes the Bazarr version contract', async () => {
    const response = await createApp(testConfig).handle(new Request('http://proxy.test/status'))
    expect(response.status).toBe(200)
    expect((await response.json()).version).toContain('bazarr-localai-proxy')
  })

  test('maps raw Bazarr ASR audio to LocalAI WAV multipart and passes SRT through', async () => {
    let outgoing: Request | undefined
    const fetcher = async (request: RequestInfo | URL, init?: RequestInit) => {
      outgoing = new Request(request, init)
      return new Response('1\n00:00:00,000 --> 00:00:01,000\nHello\n')
    }
    const app = createApp(testConfig, { fetcher: fetcher as typeof fetch })
    const response = await app.handle(upload('/asr?task=transcribe&language=id&output=srt&encode=false'))
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('Hello')
    expect(outgoing?.url).toEndWith('/v1/audio/transcriptions')
    const form = await outgoing!.formData()
    expect(form.get('model')).toBe('whisper-1')
    expect(form.get('language')).toBe('id')
    expect(form.get('response_format')).toBe('srt')
    const file = form.get('file') as File
    expect(file.name).toBe('audio.wav')
    expect(new TextDecoder().decode(new Uint8Array(await file.arrayBuffer()).subarray(0, 4))).toBe('RIFF')
  })

  test('does not silently transcribe translation requests', async () => {
    const response = await createApp(testConfig).handle(upload('/asr?task=translate'))
    expect(response.status).toBe(501)
    expect((await response.json()).error).toContain('LOCALAI_TRANSLATION_MODEL')
  })

  test('uses translation endpoint and alias when configured', async () => {
    let outgoing: Request | undefined
    const fetcher = async (request: RequestInfo | URL, init?: RequestInit) => {
      outgoing = new Request(request, init)
      return new Response('1\n00:00:00,000 --> 00:00:01,000\nTranslated\n')
    }
    const app = createApp({ ...testConfig, localAiTranslationModel: 'whisper-translate' }, { fetcher: fetcher as typeof fetch })
    expect((await app.handle(upload('/asr?task=translate'))).status).toBe(200)
    expect(outgoing?.url).toEndWith('/v1/audio/translations')
    expect((await outgoing!.formData()).get('model')).toBe('whisper-translate')
  })

  test('detects language from only the configured raw PCM prefix', async () => {
    let uploadedSize = 0
    const fetcher = async (_request: RequestInfo | URL, init?: RequestInit) => {
      const form = await new Request('http://localai.test', init).formData()
      uploadedSize = (form.get('file') as File).size
      return Response.json({ language: 'id' })
    }
    const app = createApp(testConfig, { fetcher: fetcher as typeof fetch })
    const response = await app.handle(upload('/detect-language?encode=false', new Uint8Array(64_000)))
    expect(await response.json()).toEqual({ language_code: 'id', detected_language: 'Indonesian' })
    expect(uploadedSize).toBe(32_000 + 44)
  })

  test('accepts a nested LocalAI language result', async () => {
    const fetcher = async (_request: RequestInfo | URL, _init?: RequestInit) => Response.json({
      result: { language: 'en' }, text: 'not logged',
    })
    const app = createApp(testConfig, { fetcher: fetcher as typeof fetch })
    const response = await app.handle(upload('/detect-language?encode=false'))
    expect(await response.json()).toEqual({ language_code: 'en', detected_language: 'English' })
  })

  test('returns JSON when LocalAI rejects language detection', async () => {
    const fetcher = async (_request: RequestInfo | URL, _init?: RequestInit) => new Response('unsupported response format', { status: 400 })
    const app = createApp(testConfig, { fetcher: fetcher as typeof fetch })
    const response = await app.handle(upload('/detect-language?encode=false'))
    expect(response.status).toBe(502)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect((await response.json()).error).toContain('LocalAI returned HTTP 400')
  })
})
