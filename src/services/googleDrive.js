import { google } from 'googleapis'
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

  await User.findOneAndUpdate({ uid: userId }, { driveFolderId: appFolderId })

  return { appFolderId, ...folders }
}

export async function uploadFile(userId, accessToken, fileName, data, parentFolderId) {
  const drive = getDriveClient(accessToken)

  const { data: uploaded } = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentFolderId],
    },
    media: {
      mimeType: 'application/octet-stream',
      body: Buffer.from(JSON.stringify(data)),
    },
    fields: 'id, name, size, createdTime, modifiedTime',
  })

  return uploaded
}

export async function downloadFile(accessToken, fileId) {
  const drive = getDriveClient(accessToken)

  const { data } = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'json' }
  )

  return data
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
