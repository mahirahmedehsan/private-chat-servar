import * as driveService from '../services/googleDrive.js'

export async function setup(req, res, next) {
  try {
    const accessToken = req.googleAccessToken
    if (!accessToken) {
      return res.status(400).json({ error: { message: 'Google access token required' } })
    }
    const folders = await driveService.setupAppFolders(req.user.uid, accessToken)
    res.json(folders)
  } catch (error) {
    if (error.response?.status === 403) {
      console.warn(`Drive 403: ${error.message}`)
      return res
        .status(403)
        .json({ error: { message: 'Drive API access denied. Check permissions.' } })
    }
    if (error.status === 503) {
      return res.status(503).json({ error: { message: error.message } })
    }
    next(error)
  }
}

export async function upload(req, res, next) {
  try {
    const accessToken = req.googleAccessToken
    if (!accessToken) {
      return res.status(400).json({ error: { message: 'Google access token required' } })
    }

    const file = req.file
    if (!file) {
      return res.status(400).json({ error: { message: 'No file provided' } })
    }

    const { parentFolderId, isEncrypted } = req.body

    const uploaded = await driveService.uploadFile(
      req.user.uid,
      accessToken,
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
    const accessToken = req.googleAccessToken
    if (!accessToken) {
      return res.status(400).json({ error: { message: 'Google access token required' } })
    }
    const { fileId } = req.params
    const data = await driveService.getFileBuffer(accessToken, fileId)
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
    const accessToken = req.googleAccessToken
    if (!accessToken) {
      return res.status(400).json({ error: { message: 'Google access token required' } })
    }
    const { folderId } = req.params
    const files = await driveService.listFiles(accessToken, folderId)
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
    const accessToken = req.googleAccessToken
    if (!accessToken) {
      return res.status(400).json({ error: { message: 'Google access token required' } })
    }
    const { fileId } = req.params
    await driveService.deleteFile(accessToken, fileId)
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
    const accessToken = req.googleAccessToken
    if (!accessToken) {
      return res.status(400).json({ error: { message: 'Google access token required' } })
    }
    const { fileId } = req.params
    const data = await driveService.getFileBuffer(accessToken, fileId)
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
