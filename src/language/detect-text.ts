import { detectAll } from 'tinyld'
import { normalizeLanguage } from './names'

const MIN_TEXT_LENGTH = 40
const MIN_CONFIDENCE = 0.65
const MIN_LEAD = 0.15

export function detectTranscriptLanguage(payload: unknown) {
  if (!payload || typeof payload !== 'object') return undefined
  const text = (payload as Record<string, unknown>).text
  if (typeof text !== 'string') return undefined
  const cleaned = text.replace(/\[[^\]]+]/g, ' ').replace(/\s+/g, ' ').trim()
  if (cleaned.length < MIN_TEXT_LENGTH) return undefined

  const candidates = detectAll(cleaned)
  const first = candidates[0]
  const second = candidates[1]
  if (!first || first.accuracy < MIN_CONFIDENCE) return undefined
  if (second && first.accuracy - second.accuracy < MIN_LEAD) return undefined

  const language = normalizeLanguage(first.lang)
  return language ? { language, confidence: first.accuracy } : undefined
}
