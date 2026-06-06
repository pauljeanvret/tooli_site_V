import { google, type gmail_v1 } from 'googleapis'
import { getOAuthClientForUser } from './gmail-store'
import { extractThreadMessage, type ExtractedGmailMessage } from './gmail-message-utils'

export async function fetchGmailThread(userId: string, threadId: string) {
  const { oauth2Client } = await getOAuthClientForUser(userId)
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  const response = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full',
  })

  return response.data
}

export function extractThreadMessages(thread: gmail_v1.Schema$Thread): ExtractedGmailMessage[] {
  return (thread.messages || [])
    .map(extractThreadMessage)
    .filter((message) => message.id && message.body.length > 0)
}

export function buildThreadContextForAI(thread: gmail_v1.Schema$Thread) {
  const messages = extractThreadMessages(thread)

  return {
    threadId: thread.id || null,
    messageCount: messages.length,
    messages: messages.map((message, index) => ({
      index: index + 1,
      from: message.from,
      to: message.to,
      date: message.date,
      subject: message.subject,
      bodyPreview: message.body.slice(0, 1200),
    })),
  }
}
