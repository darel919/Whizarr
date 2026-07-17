function timestampToMs(hours: string, minutes: string, seconds: string, milliseconds: string) {
  return Number(hours) * 3_600_000 + Number(minutes) * 60_000 + Number(seconds) * 1000 + Number(milliseconds)
}

function msToTimestamp(total: number) {
  const hours = Math.floor(total / 3_600_000)
  const minutes = Math.floor(total % 3_600_000 / 60_000)
  const seconds = Math.floor(total % 60_000 / 1000)
  const milliseconds = total % 1000
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`
}

export function offsetAndRenumberSrt(srt: string, offsetMs: number, firstIndex: number) {
  let nextIndex = firstIndex
  const blocks = srt.trim().split(/\r?\n\s*\r?\n/).map((block) => {
    const lines = block.split(/\r?\n/)
    const timestampIndex = lines.findIndex((line) => line.includes('-->'))
    if (timestampIndex < 0) throw new Error('SRT cue is missing timestamps')
    const match = lines[timestampIndex].match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2}),(\d{3})(.*)$/)
    if (!match) throw new Error('SRT cue has invalid timestamps')
    const start = timestampToMs(match[1], match[2], match[3], match[4]) + offsetMs
    const end = timestampToMs(match[5], match[6], match[7], match[8]) + offsetMs
    const text = lines.slice(timestampIndex + 1)
    return [String(nextIndex++), `${msToTimestamp(start)} --> ${msToTimestamp(end)}${match[9]}`, ...text].join('\n')
  })
  return { srt: blocks.join('\n\n'), nextIndex }
}
