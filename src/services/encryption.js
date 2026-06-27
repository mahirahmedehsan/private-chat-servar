import nacl from 'tweetnacl'
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util'

export function generateKeyPair() {
  const keyPair = nacl.box.keyPair()
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: encodeBase64(keyPair.secretKey),
  }
}

export function encryptMessage(text, recipientPublicKey, senderSecretKey) {
  const ephemeralKeyPair = nacl.box.keyPair()
  const recipientPub = decodeBase64(recipientPublicKey)
  const senderSecret = decodeBase64(senderSecretKey)
  const nonce = nacl.randomBytes(nacl.box.nonceLength)
  const messageBytes = decodeUTF8(text)
  const encrypted = nacl.box(messageBytes, nonce, recipientPub, senderSecret)

  return {
    encrypted: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
    ephemeralPublicKey: encodeBase64(ephemeralKeyPair.publicKey),
    version: 1,
  }
}

export function decryptMessage(encryptedData, senderPublicKey, recipientSecretKey) {
  try {
    const encrypted = decodeBase64(encryptedData.encrypted)
    const nonce = decodeBase64(encryptedData.nonce)
    const senderPub = decodeBase64(senderPublicKey)
    const recipientSecret = decodeBase64(recipientSecretKey)

    const decrypted = nacl.box.open(encrypted, nonce, senderPub, recipientSecret)
    if (!decrypted) return null

    return encodeUTF8(decrypted)
  } catch {
    return null
  }
}

export function generateSymKey() {
  return encodeBase64(nacl.randomBytes(nacl.secretbox.keyLength))
}

export function encryptWithSymKey(text, symKey) {
  const key = decodeBase64(symKey)
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength)
  const messageBytes = decodeUTF8(text)
  const encrypted = nacl.secretbox(messageBytes, nonce, key)

  return {
    encrypted: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
    version: 1,
  }
}

export function decryptWithSymKey(encryptedData, symKey) {
  try {
    const key = decodeBase64(symKey)
    const encrypted = decodeBase64(encryptedData.encrypted)
    const nonce = decodeBase64(encryptedData.nonce)

    const decrypted = nacl.secretbox.open(encrypted, nonce, key)
    if (!decrypted) return null

    return encodeUTF8(decrypted)
  } catch {
    return null
  }
}

export function encryptSymKeyForUser(symKey, recipientPublicKey, senderSecretKey) {
  return encryptMessage(symKey, recipientPublicKey, senderSecretKey)
}

export function decryptSymKeyForUser(encryptedSymKey, senderPublicKey, recipientSecretKey) {
  const decrypted = decryptMessage(encryptedSymKey, senderPublicKey, recipientSecretKey)
  return decrypted
}
