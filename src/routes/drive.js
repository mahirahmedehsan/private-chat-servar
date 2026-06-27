import { Router } from 'express'
import multer from 'multer'
import * as driveController from '../controllers/driveController.js'
import { authenticate } from '../middleware/auth.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })
const router = Router()

function attachGoogleToken(req, res, next) {
  const token = req.headers['x-google-access-token'] || req.query.token
  if (token) req.googleAccessToken = token
  next()
}

router.post('/setup', authenticate, attachGoogleToken, driveController.setup)
router.post('/upload', authenticate, attachGoogleToken, upload.single('file'), driveController.upload)
router.get('/download/:fileId', authenticate, attachGoogleToken, driveController.download)
router.get('/files/:folderId', authenticate, attachGoogleToken, driveController.list)
router.get('/proxy/:fileId', authenticate, attachGoogleToken, driveController.getFileProxy)
router.delete('/files/:fileId', authenticate, attachGoogleToken, driveController.remove)

export default router
