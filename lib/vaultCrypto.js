'use client'

/**
 * Client-side encryption for the infrastructure vault.
 *
 * The passphrase never leaves the browser and is never stored. It is stretched
 * with PBKDF2-SHA256 into an AES-GCM-256 key; Firestore only ever receives the
 * salt, the IVs and the ciphertext. Without the passphrase the stored data is
 * useless, to an attacker and to us: there is no recovery.
 */

const enc = new TextEncoder()
const dec = new TextDecoder()

// OWASP's 2023 floor for PBKDF2-SHA256. Takes ~0.5s in a browser, once per unlock.
export const PBKDF2_ITERATIONS = 600000
// Encrypted into the vault's meta doc so a wrong passphrase can be told apart
// from corrupted data before any entry is touched.
const CHECK_TEXT = 'market-neurons-vault-v1'

const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

export function newSalt() {
  return toB64(crypto.getRandomValues(new Uint8Array(16)))
}

export async function deriveKey(passphrase, saltB64, iterations = PBKDF2_ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    // Not extractable: the key can be used but never read back out of the page.
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptJson(key, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)))
  return { iv: toB64(iv), ct: toB64(ct) }
}

/** Throws on a wrong key or tampered data (AES-GCM checks integrity). */
export async function decryptJson(key, { iv, ct }) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(ct))
  return JSON.parse(dec.decode(plain))
}

export async function makeCheck(key) {
  return encryptJson(key, CHECK_TEXT)
}

export async function verifyCheck(key, check) {
  try {
    return (await decryptJson(key, check)) === CHECK_TEXT
  } catch {
    return false
  }
}

/** Rough strength gate for a new passphrase; long beats clever. */
export function passphraseProblem(p) {
  if (p.length < 14) return 'Use at least 14 characters — a short sentence works well.'
  if (new Set(p).size < 8) return 'Too repetitive. Mix more different characters or words.'
  return null
}
