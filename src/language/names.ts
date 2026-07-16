const names: Record<string, string> = {
  ar: 'Arabic', de: 'German', en: 'English', es: 'Spanish', fr: 'French', hi: 'Hindi',
  id: 'Indonesian', it: 'Italian', ja: 'Japanese', ko: 'Korean', nl: 'Dutch', pl: 'Polish',
  pt: 'Portuguese', ru: 'Russian', th: 'Thai', tr: 'Turkish', uk: 'Ukrainian', vi: 'Vietnamese', zh: 'Chinese',
}

export function normalizeLanguage(value: unknown) {
  if (typeof value !== 'string') return undefined
  const code = value.trim().toLowerCase().split(/[-_]/)[0]
  if (!/^[a-z]{2}$/.test(code)) return undefined
  return { language_code: code, detected_language: names[code] || code.toUpperCase() }
}

export function extractLanguage(payload: unknown) {
  if (!payload || typeof payload !== 'object') return undefined
  const value = payload as Record<string, unknown>
  const result = value.result && typeof value.result === 'object' ? value.result as Record<string, unknown> : undefined
  const data = value.data && typeof value.data === 'object' ? value.data as Record<string, unknown> : undefined
  return normalizeLanguage(
    value.language ?? value.language_code ?? result?.language ?? result?.language_code ?? data?.language ?? data?.language_code,
  )
}

export function summarizeLanguagePayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return { type: Array.isArray(payload) ? 'array' : typeof payload }
  const value = payload as Record<string, unknown>
  const objectKeys = (candidate: unknown) => candidate && typeof candidate === 'object'
    ? Object.keys(candidate as Record<string, unknown>).slice(0, 20) : undefined
  const firstSegment = Array.isArray(value.segments) ? value.segments[0] : undefined
  return {
    keys: Object.keys(value).slice(0, 20),
    resultKeys: objectKeys(value.result),
    dataKeys: objectKeys(value.data),
    firstSegmentKeys: objectKeys(firstSegment),
    languageValueType: typeof value.language,
  }
}
