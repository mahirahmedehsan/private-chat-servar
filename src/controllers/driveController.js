import * as driveService from '../services/googleDriveServiceAccount.js'

export async function setup(req, res, next) {
  try {
    const folders = await driveService.setupAppFolders(req.user.uid)
    res.json(folders)
  } catch (error) {
    if (error.response?.status === 403) {
      return res
        .status(403)
        .json({ error: { message: 'Drive API not enabled for service account' } })
    }
    if (error.status === 503) {
      return res.status(503).json({ error: { message: error.message } })
    }
    next(error)
  }
}

export async function upload(req, res, next) {
  try {
    const file = req.file
    if (!file) {
      return res.status(400).json({ error: { message: 'No file provided' } })
    }

    const { parentFolderId, isEncrypted } = req.body

    const uploaded = await driveService.uploadFile(
      req.user.uid,
      file.originalname,
      file.buffer,
      file.mimetype,
      parentFolderId,
      isEncrypted !== 'false'
    )

    res.status(201).json(uploaded)
  } catch (error) {
    if (error.status === 503) {
      return res.status(503).json({ error: { message: error.message } })
    }
    next(error)
  }
}

export async function download(req, res, next) {
  try {
    const { fileId } = req.params
    const data = await driveService.getSignedUrl(fileId)
    res.set('Content-Type', 'application/octet-stream')
    res.send(data)
  } catch (error) {
    if (error.response?.status === 404) {
      return res.status(404).json({ error: { message: 'File not found' } })
    }
    if (error.status === 503) {
      return res.status(503).json({ error: { message: error.message } })
    }
    next(error)
  }
}

export async function list(req, res, next) {
  try {
    const { folderId } = req.params
    const files = await driveService.listFiles(folderId)
    res.json(files)
  } catch (error) {
    if (error.status === 503) {
      return res.status(503).json({ error: { message: error.message } })
    }
    next(error)
  }
}

export async function remove(req, res, next) {
  try {
    const { fileId } = req.params
    await driveService.deleteFile(fileId)
    res.json({ message: 'File deleted' })
  } catch (error) {
    if (error.response?.status === 404) {
      return res.status(404).json({ error: { message: 'File not found' } })
    }
    if (error.status === 503) {
      return res.status(503).json({ error: { message: error.message } })
    }
    next(error)
  }
}

export async function getFileProxy(req, res, next) {
  try {
    const { fileId } = req.params
    const data = await driveService.getSignedUrl(fileId)
    const mimeType = req.query.mime || 'application/octet-stream'
    res.set('Content-Type', mimeType)
    res.set('Cache-Control', 'private, max-age=3600')
    res.set('X-Content-Type-Options', 'nosniff')
    res.send(data)
  } catch (error) {
    if (error.response?.status === 404) {
      return res.status(404).json({ error: { message: 'File not found' } })
    }
    if (error.status === 503) {
      return res.status(503).json({ error: { message: error.message } })
    }
    next(error)
  }
}
