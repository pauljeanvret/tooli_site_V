import { cleanAiDraftBody } from '@/lib/ai/provider'

export function sanitizeEmailHeader(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

export function encodeEmailSubject(value: string) {
  return `=?UTF-8?B?${Buffer.from(sanitizeEmailHeader(value), 'utf8').toString('base64')}?=`
}

export function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function normalizeSubject(input: { subject: string; testDraft?: boolean }) {
  let subject = input.subject
    .replace(/\[Test Toolia\]/gi, '')
    .replace(/\bToolia\b/gi, '')
    .replace(/\btest\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!subject) subject = 'Réponse à votre message'
  if (input.testDraft && !subject.startsWith('[Test Toolia]')) {
    subject = `[Test Toolia] ${subject}`
  }

  return subject
}

export function buildGmailDraftMime(input: {
  to: string
  subject: string
  body: string
  testDraft?: boolean
  inReplyTo?: string
  references?: string
}) {
  const subject = normalizeSubject(input)
  const body = cleanAiDraftBody(input.body).replace(/\n/g, '\r\n')
  const headers = [
    `To: ${sanitizeEmailHeader(input.to)}`,
    `Subject: ${encodeEmailSubject(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
  ]

  if (input.inReplyTo) {
    headers.push(`In-Reply-To: ${sanitizeEmailHeader(input.inReplyTo)}`)
  }

  if (input.references) {
    headers.push(`References: ${sanitizeEmailHeader(input.references)}`)
  }

  return [...headers, '', body].join('\r\n')
}
