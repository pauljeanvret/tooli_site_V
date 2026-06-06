import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

function getSecret() {
  return (
    process.env.ENCRYPTION_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  )
}

function getKey() {
  const secret = getSecret()
  if (!secret) throw new Error('Encryption secret missing.')

  return createHash('sha256').update(secret).digest()
}

export function encryptSecret(value: string | null | undefined) {
  if (!value) return null

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':')
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) return null
  if (!value.startsWith('v1:')) return value

  const [, ivValue, tagValue, encryptedValue] = value.split(':')
  if (!ivValue || !tagValue || !encryptedValue) throw new Error('Invalid encrypted secret format.')

  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
