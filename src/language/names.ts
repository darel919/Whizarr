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
