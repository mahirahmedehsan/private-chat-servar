import { Router } from 'express'
import multer from 'multer'
import * as driveController from '../controllers/driveController.js'
import { authenticate } from '../middleware/auth.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })
const router = Router()

router.post('/setup', authenticate, driveController.setup)
router.post('/upload', authenticate, upload.single('file'), driveController.upload)
router.get('/download/:fileId', authenticate, driveController.download)
router.get('/files/:folderId', authenticate, driveController.list)
router.get('/proxy/:fileId', authenticate, driveController.getFileProxy)
router.delete('/files/:fileId', authenticate, driveController.remove)

export default router
