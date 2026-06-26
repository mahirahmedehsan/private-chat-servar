import { getDatabase } from '../config/firebase.js'

const SYNC_PATH = 'sync'
const BACKUP_PATH = 'backups'
const PENDING_PATH = 'pendingChanges'

function db() {
  const instance = getDatabase()
  if (!instance) throw new Error('RTDB not available')
  return instance
}

function ref(path) {
  return db().ref(path)
}

export async function getSyncState(userId, deviceId) {
  const snap = await ref(`${SYNC_PATH}/${userId}/${deviceId}`).once('value')
  return snap.val()
}

export async function getAllDevices(userId) {
  const snap = await ref(`${SYNC_PATH}/${userId}`).once('value')
  const data = snap.val()
  if (!data) return []
  return Object.entries(data).map(([deviceId, state]) => ({ deviceId, ...state }))
}

export async function setSyncState(userId, deviceId, state) {
  await ref(`${SYNC_PATH}/${userId}/${deviceId}`).update(state)
}

export async function removeDevice(userId, deviceId) {
  await ref(`${SYNC_PATH}/${userId}/${deviceId}`).remove()
}

export async function addPendingChange(userId, change) {
  const pushRef = ref(`${PENDING_PATH}/${userId}`).push()
  await pushRef.set({ ...change, queuedAt: Date.now() })
  return pushRef.key
}

export async function getPendingChanges(userId) {
  const snap = await ref(`${PENDING_PATH}/${userId}`).once('value')
  const data = snap.val()
  if (!data) return []
  return Object.entries(data).map(([id, entry]) => ({ id, ...entry }))
}

export async function clearPendingChange(userId, changeId) {
  await ref(`${PENDING_PATH}/${userId}/${changeId}`).remove()
}

export async function recordBackup(userId, backup) {
  const pushRef = ref(`${BACKUP_PATH}/${userId}`).push()
  await pushRef.set({ ...backup, createdAt: Date.now() })
  return pushRef.key
}

export async function getBackups(userId, limit = 20) {
  const snap = await ref(`${BACKUP_PATH}/${userId}`)
    .orderByChild('createdAt')
    .limitToLast(limit)
    .once('value')
  const data = snap.val()
  if (!data) return []
  return Object.entries(data)
    .map(([id, entry]) => ({ id, ...entry }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

export function listenForChanges(userId, callback) {
  const changesRef = ref(`${PENDING_PATH}/${userId}`)
  changesRef.on('child_added', (snap) => {
    callback({ id: snap.key, ...snap.val() })
  })
  return () => changesRef.off()
}

export function listenForBackups(userId, callback) {
  const backupsRef = ref(`${BACKUP_PATH}/${userId}`)
  backupsRef.limitToLast(1).on('child_added', (snap) => {
    callback({ id: snap.key, ...snap.val() })
  })
  return () => backupsRef.off()
}
