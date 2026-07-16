import { describe, expect, test } from 'bun:test'
import { rawPcm16LeToWav } from '../src/audio/wav'

describe('rawPcm16LeToWav', () => {
  test.each([0, 4, 1_000_000])('writes a valid header for %i PCM bytes', (length) => {
    const wav = rawPcm16LeToWav(new Uint8Array(length))
    const view = new DataView(wav.buffer)
    expect(new TextDecoder().decode(wav.subarray(0, 4))).toBe('RIFF')
    expect(new TextDecoder().decode(wav.subarray(8, 12))).toBe('WAVE')
    expect(view.getUint32(4, true)).toBe(36 + length)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(16_000)
    expect(view.getUint16(34, true)).toBe(16)
    expect(view.getUint32(40, true)).toBe(length)
  })

  test('rejects an incomplete 16-bit sample', () => {
    expect(() => rawPcm16LeToWav(new Uint8Array(3))).toThrow('aligned')
  })
})
