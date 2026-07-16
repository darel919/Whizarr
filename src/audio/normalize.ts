import { rawPcm16LeToWav } from './wav'

const CONTAINER_TYPES = new Set([
  'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/flac', 'audio/ogg', 'audio/webm',
])

export async function normalizeAudio(file: File, encode: string | undefined, byteLimit?: number) {
  const source = new Uint8Array(await file.arrayBuffer())
  const bytes = byteLimit === undefined ? source : source.subarray(0, byteLimit)
  const shouldWrap = encode !== 'true' && !CONTAINER_TYPES.has(file.type.toLowerCase())
  if (shouldWrap) {
    const wav = rawPcm16LeToWav(bytes)
    return new File([wav.slice().buffer], 'audio.wav', { type: 'audio/wav' })
  }
  return new File([bytes.slice().buffer], file.name || 'audio', { type: file.type || 'application/octet-stream' })
}
