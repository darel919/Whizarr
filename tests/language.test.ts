import { expect, test } from 'bun:test'
import { detectTranscriptLanguage } from '../src/language/detect-text'

test('detects English from a sufficiently long transcript', () => {
  const result = detectTranscriptLanguage({
    text: 'This is a clear English transcript with several spoken sentences about a haunted house and an investigation.',
  })
  expect(result?.language.language_code).toBe('en')
})

test('detects Indonesian from a sufficiently long transcript', () => {
  const result = detectTranscriptLanguage({
    text: 'Ini adalah percakapan dalam bahasa Indonesia tentang sebuah rumah tua yang sangat menyeramkan dan penuh misteri.',
  })
  expect(result?.language).toEqual({ language_code: 'id', detected_language: 'Indonesian' })
})

test('refuses to guess from short text', () => {
  expect(detectTranscriptLanguage({ text: 'Hello.' })).toBeUndefined()
})
