import { rawPcm16LeToWav } from './wav'

const CONTAINER_TYPES = new Set([
  'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/flac', 'audio/ogg', 'audio/webm',
])

export function isRawPcmUpload(file: File, encode: string | undefined) {
  return encode !== 'true' && !CONTAINER_TYPES.has(file.type.toLowerCase())
}

export async function normalizeAudio(file: File, encode: string | undefined, byteLimit?: number) {
  const source = new Uint8Array(await file.arrayBuffer())
  const bytes = byteLimit === undefined ? source : source.subarray(0, byteLimit)
  const shouldWrap = isRawPcmUpload(file, encode)
  if (shouldWrap) {
    const wav = rawPcm16LeToWav(bytes)
    return new File([wav.slice().buffer], 'audio.wav', { type: 'audio/wav' })
  }
  return new File([bytes.slice().buffer], file.name || 'audio', { type: file.type || 'application/octet-stream' })
}

export async function normalizeDetectionAudio(file: File, encode: string | undefined, byteLimit: number) {
  const source = new Uint8Array(await file.arrayBuffer())
  const isRawPcm = isRawPcmUpload(file, encode)
  if (!isRawPcm || source.byteLength <= byteLimit) return normalizeAudio(file, encode, byteLimit)

  // Movie openings are frequently silence, music, or credits. Use three equal
  // windows across the runtime while keeping the same total inference duration.
  const bytesPerWindow = Math.floor(byteLimit / 3 / 2) * 2
  const windowSizes = [bytesPerWindow, bytesPerWindow, byteLimit - bytesPerWindow * 2]
  const output = new Uint8Array(byteLimit)
  const positions = [0.1, 0.5, 0.85]
  let outputOffset = 0
  for (let index = 0; index < positions.length; index++) {
    const windowSize = windowSizes[index]
    const maximumStart = source.byteLength - windowSize
    const start = Math.floor(maximumStart * positions[index] / 2) * 2
    output.set(source.subarray(start, start + windowSize), outputOffset)
    outputOffset += windowSize
  }
  const wav = rawPcm16LeToWav(output)
  return new File([wav.slice().buffer], 'audio.wav', { type: 'audio/wav' })
}

export async function chunkRawPcm(file: File, encode: string | undefined, chunkBytes: number) {
  if (!isRawPcmUpload(file, encode)) return undefined
  const source = new Uint8Array(await file.arrayBuffer())
  const alignedChunkBytes = Math.floor(chunkBytes / 2) * 2
  const chunks: Array<{ file: File; offsetBytes: number; pcmBytes: number }> = []
  for (let offset = 0; offset < source.byteLength; offset += alignedChunkBytes) {
    const pcm = source.subarray(offset, Math.min(offset + alignedChunkBytes, source.byteLength))
    const wav = rawPcm16LeToWav(pcm)
    chunks.push({
      file: new File([wav.slice().buffer], `audio-${chunks.length + 1}.wav`, { type: 'audio/wav' }),
      offsetBytes: offset,
      pcmBytes: pcm.byteLength,
    })
  }
  return chunks
}
