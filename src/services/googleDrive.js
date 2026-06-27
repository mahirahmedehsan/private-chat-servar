import { google } from 'googleapis'
import { Readable } from 'stream'
import User from '../models/User.js'
import config from '../config/index.js'

const APP_FOLDER_NAME = 'PrivateChat'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

function getDriveClient(accessToken) {
  const auth = new google.auth.OAuth2(config.google.clientId, config.google.clientSecret)
  auth.setCredentials({ access_token: accessToken })
  return google.drive({ version: 'v3', auth })
}

function escapeQuery(name) {
  return name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

async function findOrCreateFolder(drive, name, parentId = null) {
  const escaped = escapeQuery(name)
  const query = [`name='${escaped}'`, "mimeType='application/vnd.google-apps.folder'", 'trashed=false']
  if (parentId) query.push(`'${parentId}' in parents`)

  const { data } = await drive.files.list({
    q: query.join(' and '),
    fields: 'files(id, name)',
    spaces: 'drive',
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

export async function setupAppFolders(userId, accessToken) {
  const drive = getDriveClient(accessToken)

  const appFolderId = await findOrCreateFolder(drive, APP_FOLDER_NAME)

  const folders = {
    Chats: null,
    Media: null,
    Backups: null,
    Profile: null,
    Settings: null,
  }

  for (const name of Object.keys(folders)) {
    folders[name] = await findOrCreateFolder(drive, name, appFolderId)
  }

  await User.findOneAndUpdate(
    { uid: userId },
    {
      driveFolderId: appFolderId,
      driveFolders: { appFolderId, ...folders },
    }
  )

  return { appFolderId, ...folders }
}

export async function uploadFile(userId, accessToken, fileName, fileBuffer, mimeType, parentFolderId, isEncrypted = true) {
  const drive = getDriveClient(accessToken)

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

  return {
    id: uploaded.id,
    name: uploaded.name,
    size: uploaded.size,
    mimeType: uploaded.mimeType,
    createdTime: uploaded.createdTime,
  }
}

export async function getFileBuffer(accessToken, fileId) {
  const drive = getDriveClient(accessToken)

  const { data } = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  )

  return Buffer.from(data)
}

export async function listFiles(accessToken, folderId) {
  const drive = getDriveClient(accessToken)

  const { data } = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, size, createdTime, modifiedTime, mimeType)',
    orderBy: 'modifiedTime desc',
  })

  return data.files || []
}

export async function deleteFile(accessToken, fileId) {
  const drive = getDriveClient(accessToken)
  await drive.files.delete({ fileId })
}

export async function getFile(accessToken, fileId) {
  const drive = getDriveClient(accessToken)
  const { data } = await drive.files.get({
    fileId,
    fields: 'id, name, size, createdTime, modifiedTime, mimeType',
  })
  return data
}

export async function getUserFolder(userId) {
  const user = await User.findOne({ uid: userId })
    .select('driveFolderId driveFolders')
    .lean()
  return user?.driveFolders || null
}

export async function deleteUserFolder(userId, accessToken) {
  const user = await User.findOne({ uid: userId })
    .select('driveFolderId driveFolders')
    .lean()
  if (!user?.driveFolderId) return

  const drive = getDriveClient(accessToken)
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
