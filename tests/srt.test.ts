import { expect, test } from 'bun:test'
import { offsetAndRenumberSrt } from '../src/subtitles/srt'

test('offsets timestamps and renumbers multiline SRT cues', () => {
  const input = `7
00:00:01,250 --> 00:00:02,500
First line
Second line

8
00:00:03,000 --> 00:00:04,000
Next cue`
  const result = offsetAndRenumberSrt(input, 600_000, 12)
  expect(result.nextIndex).toBe(14)
  expect(result.srt).toContain('12\n00:10:01,250 --> 00:10:02,500\nFirst line\nSecond line')
  expect(result.srt).toContain('13\n00:10:03,000 --> 00:10:04,000\nNext cue')
})
