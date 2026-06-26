import admin from 'firebase-admin'
import config from './index.js'

let firebaseApp = null

export function getFirebaseAdmin() {
  if (firebaseApp) return firebaseApp

  if (!config.firebase.projectId || !config.firebase.clientEmail || !config.firebase.privateKey) {
    console.warn('Firebase Admin not configured — auth endpoints will fail')
    return null
  }

  const credential = admin.credential.cert({
    projectId: config.firebase.projectId,
    clientEmail: config.firebase.clientEmail,
    privateKey: config.firebase.privateKey,
  })

  const initOptions = { credential }
  if (config.firebase.databaseURL) {
    initOptions.databaseURL = config.firebase.databaseURL
  }

  firebaseApp = admin.initializeApp(initOptions)

  return firebaseApp
}

export function getAuth() {
  const app = getFirebaseAdmin()
  if (!app) return null
  return admin.auth()
}

export function getDatabase() {
  const app = getFirebaseAdmin()
  if (!app) return null
  if (!config.firebase.databaseURL) {
    console.warn('FIREBASE_DATABASE_URL not set — RTDB unavailable')
    return null
  }
  return admin.database()
}
