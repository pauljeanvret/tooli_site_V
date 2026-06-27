export const ADMIN_EMAILS = [
  'tooliadev@gmail.com',
  'jeanvretpaul@gmail.com',
  'e4756782@gmail.com',
] as const

export function getAdminEmails() {
  const configuredEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)

  return Array.from(new Set([...ADMIN_EMAILS, ...configuredEmails]))
}

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false
  return getAdminEmails().includes(email.trim().toLowerCase())
}
