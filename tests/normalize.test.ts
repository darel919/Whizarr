import { expect, test } from 'bun:test'
import { normalizeDetectionAudio } from '../src/audio/normalize'

test('distributes raw PCM detection windows across the recording', async () => {
  const pcm = new Uint8Array(300)
  pcm.fill(1, 0, 100)
  pcm.fill(2, 100, 200)
  pcm.fill(3, 200)
  const file = new File([pcm], 'audio.raw', { type: 'application/octet-stream' })
  const wav = await normalizeDetectionAudio(file, 'false', 60)
  const data = new Uint8Array(await wav.arrayBuffer()).subarray(44)
  expect(data.length).toBe(60)
  expect(new Set(data.subarray(0, 20))).toEqual(new Set([1]))
  expect(new Set(data.subarray(20, 40))).toEqual(new Set([2]))
  expect(new Set(data.subarray(40, 60))).toEqual(new Set([3]))
})
