import type { gmail_v1 } from 'googleapis'

export type ExtractedGmailMessage = {
  id: string
  threadId: string | null
  from: string
  to: string
  subject: string
  date: string
  body: string
}

export function getGmailHeader(message: gmail_v1.Schema$Message, name: string) {
  const headers = message.payload?.headers || []
  return headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value || ''
}

function decodeBase64Url(data: string | null | undefined) {
  if (!data) return ''

  const padded = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(padded, 'base64').toString('utf8')
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function collectParts(part: gmail_v1.Schema$MessagePart | undefined, mimeType: string, output: string[] = []) {
  if (!part) return output

  if (part.mimeType === mimeType && part.body?.data) {
    output.push(decodeBase64Url(part.body.data))
  }

  for (const child of part.parts || []) {
    collectParts(child, mimeType, output)
  }

  return output
}

export function messageHasAttachments(message: gmail_v1.Schema$Message) {
  const stack = [message.payload].filter(Boolean) as gmail_v1.Schema$MessagePart[]

  while (stack.length) {
    const part = stack.pop()
    if (!part) continue
    if (part.filename && part.body?.attachmentId) return true
    stack.push(...(part.parts || []))
  }

  return false
}

export function extractGmailMessageText(message: gmail_v1.Schema$Message) {
  const plainParts = collectParts(message.payload, 'text/plain')
  if (plainParts.length) {
    return normalizeEmailBody(plainParts.join('\n\n'))
  }

  const htmlParts = collectParts(message.payload, 'text/html')
  if (htmlParts.length) {
    return normalizeEmailBody(stripHtml(htmlParts.join('\n\n')))
  }

  return normalizeEmailBody(decodeBase64Url(message.payload?.body?.data))
}

export function normalizeEmailBody(value: string) {
  return value
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^\s*>.*$/gm, '')
    .replace(/Le .+ a écrit\s*:/gi, '')
    .replace(/On .+ wrote\s*:/gi, '')
    .trim()
}

export function isLikelyAutomatedMessage(message: gmail_v1.Schema$Message, body: string) {
  const autoSubmitted = getGmailHeader(message, 'Auto-Submitted')
  const precedence = getGmailHeader(message, 'Precedence')
  const listUnsubscribe = getGmailHeader(message, 'List-Unsubscribe')
  const subject = getGmailHeader(message, 'Subject')

  return Boolean(
    (autoSubmitted && autoSubmitted.toLowerCase() !== 'no') ||
      /bulk|list|junk/i.test(precedence) ||
      listUnsubscribe ||
      /ne pas répondre|do not reply|no[- ]?reply|notification automatique/i.test(subject) ||
      /unsubscribe|se désabonner|désinscription/i.test(body),
  )
}

export function extractThreadMessage(message: gmail_v1.Schema$Message): ExtractedGmailMessage {
  return {
    id: message.id || '',
    threadId: message.threadId || null,
    from: getGmailHeader(message, 'From'),
    to: getGmailHeader(message, 'To'),
    subject: getGmailHeader(message, 'Subject'),
    date: getGmailHeader(message, 'Date'),
    body: extractGmailMessageText(message),
  }
}
