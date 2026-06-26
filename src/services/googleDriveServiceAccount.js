import { google } from 'googleapis'
import { Readable } from 'stream'
import config from '../config/index.js'
import User from '../models/User.js'

const SCOPES = ['https://www.googleapis.com/auth/drive.file']
const APP_FOLDER_NAME = 'PrivateChat'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

let _auth = null
let _drive = null
let _configured = null

function isConfigured() {
  if (_configured !== null) return _configured
  _configured = !!(config.google.serviceAccountEmail && config.google.serviceAccountPrivateKey)
  return _configured
}

function notConfiguredError() {
  const err = new Error(
    'Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in server .env'
  )
  err.status = 503
  err.expose = true
  return err
}

function getAuth() {
  if (_auth) return _auth
  if (!isConfigured()) throw notConfiguredError()
  _auth = new google.auth.JWT({
    email: config.google.serviceAccountEmail,
    key: config.google.serviceAccountPrivateKey,
    scopes: SCOPES,
    subject: config.google.serviceAccountSubject || undefined,
  })
  return _auth
}

function getDrive() {
  if (_drive) return _drive
  _drive = google.drive({ version: 'v3', auth: getAuth() })
  return _drive
}

function escapeQuery(name) {
  return name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

async function findOrCreateFolder(drive, name, parentId = null) {
  const escaped = escapeQuery(name)
  const query = [
    `name='${escaped}'`,
    `mimeType='${FOLDER_MIME}'`,
    'trashed=false',
  ]
  if (parentId) query.push(`'${parentId}' in parents`)

  const { data } = await drive.files.list({
    q: query.join(' and '),
    fields: 'files(id, name)',
    spaces: 'drive',
    pageSize: 1,
  })

  if (data.files?.length > 0) return data.files[0].id

  const fileMetadata = {
    name,
    mimeType: FOLDER_MIME,
    ...(parentId ? { parents: [parentId] } : {}),
  }

  const { data: created } = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id',
  })

  return created.id
}

export async function setupAppFolders(userId) {
  const drive = getDrive()
  const appFolderId = await findOrCreateFolder(drive, APP_FOLDER_NAME)

  const folderNames = ['Chats', 'Media', 'Backups', 'Profile', 'Settings']
  const folders = {}
  for (const name of folderNames) {
    folders[name] = await findOrCreateFolder(drive, name, appFolderId)
  }

  const permission = {
    type: 'anyone',
    role: 'reader',
  }

  await drive.permissions.create({
    fileId: appFolderId,
    requestBody: { ...permission },
  })

  const user = await User.findOneAndUpdate(
    { uid: userId },
    {
      driveFolderId: appFolderId,
      driveFolders: { appFolderId, ...folders },
      driveServiceAccount: true,
    },
    { new: true }
  )

  return { appFolderId, ...folders }
}

export async function uploadFile(
  userId,
  fileName,
  fileBuffer,
  mimeType,
  parentFolderId,
  isEncrypted = true
) {
  const drive = getDrive()

  const fileMetadata = {
    name: `${userId}_${Date.now()}_${fileName}`,
    parents: parentFolderId ? [parentFolderId] : undefined,
    description: `Uploaded by user ${userId} | Encrypted: ${isEncrypted}`,
  }

  const media = {
    mimeType: mimeType || 'application/octet-stream',
    body: fileBuffer instanceof Buffer ? Readable.from(fileBuffer) : fileBuffer,
  }

  const { data: uploaded } = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id, name, size, createdTime, mimeType, webViewLink, webContentLink',
  })

  const permission = {
    type: 'user',
    role: 'reader',
    emailAddress: (await User.findOne({ uid: userId }).select('email').lean())
      ?.email,
  }
  if (permission.emailAddress) {
    try {
      await drive.permissions.create({
        fileId: uploaded.id,
        requestBody: permission,
        sendNotificationEmail: false,
      })
    } catch {
      // permission may fail if the user is not in the same domain
    }
  }

  return {
    id: uploaded.id,
    name: uploaded.name,
    size: uploaded.size,
    mimeType: uploaded.mimeType,
    createdTime: uploaded.createdTime,
  }
}

export async function getSignedUrl(fileId) {
  const drive = getDrive()
  const { data } = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  )
  return Buffer.from(data)
}

export async function listFiles(folderId) {
  const drive = getDrive()
  const { data } = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, size, createdTime, modifiedTime, mimeType)',
    orderBy: 'modifiedTime desc',
  })
  return data.files || []
}

export async function deleteFile(fileId) {
  const drive = getDrive()
  await drive.files.delete({ fileId })
}

export async function getUserFolder(userId) {
  const user = await User.findOne({ uid: userId })
    .select('driveFolderId driveFolders')
    .lean()
  return user?.driveFolders || null
}

export async function deleteUserFolder(userId) {
  const user = await User.findOne({ uid: userId })
    .select('driveFolderId driveFolders')
    .lean()
  if (!user?.driveFolderId) return

  const drive = getDrive()
  try {
    await drive.files.delete({ fileId: user.driveFolderId })
  } catch {
    // folder may have already been deleted
  }

  await User.findOneAndUpdate(
    { uid: userId },
    { $unset: { driveFolderId: '', driveFolders: '', driveServiceAccount: '' } }
  )
}
