import type { Config } from '../src/config'

export const testConfig: Config = {
  port: 9000, localAiBaseUrl: 'http://localai.test', localAiModel: 'whisper-1',
  connectTimeoutMs: 100, transcriptionTimeoutMs: 1000, detectionSeconds: 1,
  asrChunkSeconds: 600,
  maxConcurrentTranscriptions: 1, maxAudioUploadBytes: 1024 * 1024,
  logLevel: 'error', logFullVideoPath: false,
}

export function upload(path: string, bytes = new Uint8Array([0, 0, 1, 0])) {
  const form = new FormData()
  form.append('audio_file', new File([bytes], 'audio.raw', { type: 'application/octet-stream' }))
  return new Request(`http://proxy.test${path}`, { method: 'POST', body: form })
}
