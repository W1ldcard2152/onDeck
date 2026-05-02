/**
 * AES-256-GCM token encryption for OAuth integration credentials.
 *
 * Format: <iv_b64>:<authtag_b64>:<ciphertext_b64>
 *   - iv:         12 random bytes (96-bit, standard for GCM)
 *   - authtag:    16 bytes (128-bit GCM authentication tag)
 *   - ciphertext: encrypted UTF-8 plaintext
 *
 * Security model: protects token confidentiality at rest in the database.
 * The auth tag verifies the ciphertext blob has not been tampered with,
 * but does not authenticate the surrounding database row. RLS policies
 * on user_integrations prevent cross-user row access.
 *
 * Key source: INTEGRATION_ENCRYPTION_KEY env var — a 64-char hex string
 * (32 bytes). Generate with: openssl rand -hex 32
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (cachedKey) return cachedKey
  const keyHex = process.env.INTEGRATION_ENCRYPTION_KEY
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'INTEGRATION_ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes). ' +
      'Generate one with: openssl rand -hex 32'
    )
  }
  cachedKey = Buffer.from(keyHex, 'hex')
  return cachedKey
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`
}

export function decryptToken(ciphertext: string): string {
  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format: expected <iv_b64>:<authtag_b64>:<ciphertext_b64>')
  }
  const [ivB64, authTagB64, dataB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')

  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(authTag)
  try {
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
    return decrypted.toString('utf8')
  } catch {
    throw new Error('Failed to decrypt token: authentication tag verification failed or key mismatch')
  }
}
