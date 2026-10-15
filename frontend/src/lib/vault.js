import { create } from 'zustand'
import { useStore } from './store'

/* Bóveda de secretos (contraseñas, cuentas…).

   Todo se cifra y descifra EN EL NAVEGADOR con una clave que sale de la frase
   maestra (PBKDF2, 600.000 iteraciones → AES-GCM 256). El servidor solo guarda
   la sal y una comprobación cifrada, nunca la frase ni la clave: ni una copia
   de la base de datos permite leer los secretos. La contrapartida: si se
   olvida la frase, los secretos no se pueden recuperar.

   «Recordar en este dispositivo» guarda la clave en IndexedDB como CryptoKey
   NO extraíble: el navegador la puede usar para descifrar, pero nadie puede
   leerla ni copiarla de ahí. */

const ITER = 600_000
const CHECK = 'mentodo-vault-ok'
const enc = new TextEncoder()
const dec = new TextDecoder()

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export const vaultSupported = () => !!globalThis.crypto?.subtle && window.isSecureContext

export const useVault = create(() => ({ key: null, restoring: true }))

async function derive(pass, saltB64) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: unb64(saltB64), iterations: ITER, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false, // no extraíble
    ['encrypt', 'decrypt'],
  )
}

async function encWith(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text))
  return { iv: b64(iv), ct: b64(ct) }
}

async function decWith(key, { iv, ct }) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct))
  return dec.decode(pt)
}

/* ── IndexedDB mínima para recordar la clave en este dispositivo ── */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('mentodo-vault', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('keys')
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
async function idbDo(mode, fn) {
  const db = await idb()
  return new Promise((res, rej) => {
    const tx = db.transaction('keys', mode)
    const req = fn(tx.objectStore('keys'))
    tx.oncomplete = () => res(req?.result)
    tx.onerror = () => rej(tx.error)
  })
}
const remember = (userId, salt, key) => idbDo('readwrite', (st) => st.put({ salt, key }, `u${userId}`)).catch(() => {})
const forget = (userId) => idbDo('readwrite', (st) => st.delete(`u${userId}`)).catch(() => {})

/* Al arrancar: si este dispositivo recordaba la clave (y es de la bóveda
   actual), queda desbloqueada sin pedir la frase */
export async function restoreVault() {
  const user = useStore.getState().user
  try {
    if (!user?.vault_salt || !vaultSupported()) return
    const saved = await idbDo('readonly', (st) => st.get(`u${user.id}`))
    if (saved?.key && saved.salt === user.vault_salt) {
      await decWith(saved.key, parseCheck(user.vault_check))
      useVault.setState({ key: saved.key })
    }
  } catch {
    // clave guardada que ya no sirve: se ignora
  } finally {
    useVault.setState({ restoring: false })
  }
}

const parseCheck = (s) => {
  const [iv, ct] = (s || '').split('.')
  return { iv, ct }
}

export async function createVault(pass, keep) {
  const user = useStore.getState().user
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)))
  const key = await derive(pass, salt)
  const c = await encWith(key, CHECK)
  await useStore.getState().updateMe({ vault_salt: salt, vault_check: `${c.iv}.${c.ct}` })
  if (useStore.getState().user?.vault_salt !== salt) throw new Error('No se pudo guardar la bóveda')
  useVault.setState({ key })
  if (keep) await remember(user.id, salt, key)
}

export async function unlockVault(pass, keep) {
  const user = useStore.getState().user
  const key = await derive(pass, user.vault_salt)
  try {
    if ((await decWith(key, parseCheck(user.vault_check))) !== CHECK) throw new Error()
  } catch {
    throw new Error('Frase maestra incorrecta')
  }
  useVault.setState({ key })
  if (keep) await remember(user.id, user.vault_salt, key)
}

export async function lockVault() {
  const user = useStore.getState().user
  useVault.setState({ key: null })
  if (user) await forget(user.id)
}

export async function sealSecret(obj) {
  const key = useVault.getState().key
  if (!key) throw new Error('Bóveda bloqueada')
  return encWith(key, JSON.stringify(obj))
}

export async function openSecret(sealed) {
  const key = useVault.getState().key
  if (!key) throw new Error('Bóveda bloqueada')
  return JSON.parse(await decWith(key, sealed))
}

export function generatePassword(len = 20) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*-_+='
  const rnd = crypto.getRandomValues(new Uint32Array(len))
  return Array.from(rnd, (n) => chars[n % chars.length]).join('')
}
