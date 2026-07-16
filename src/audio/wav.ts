export const PCM_SAMPLE_RATE = 16_000
export const PCM_CHANNELS = 1
export const PCM_BITS_PER_SAMPLE = 16

export function rawPcm16LeToWav(
  pcm: ArrayBuffer | Uint8Array,
  sampleRate = PCM_SAMPLE_RATE,
  channels = PCM_CHANNELS,
  bitsPerSample = PCM_BITS_PER_SAMPLE,
): Uint8Array {
  const bytes = pcm instanceof Uint8Array ? pcm : new Uint8Array(pcm)
  if (sampleRate <= 0 || channels <= 0 || bitsPerSample <= 0 || bitsPerSample % 8 !== 0) {
    throw new Error('Invalid PCM format')
  }
  const blockAlign = channels * (bitsPerSample / 8)
  if (bytes.byteLength % blockAlign !== 0) throw new Error('PCM byte length is not aligned to complete samples')

  const output = new Uint8Array(44 + bytes.byteLength)
  const view = new DataView(output.buffer)
  const ascii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++) output[offset + index] = value.charCodeAt(index)
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + bytes.byteLength, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  ascii(36, 'data')
  view.setUint32(40, bytes.byteLength, true)
  output.set(bytes, 44)
  return output
}
