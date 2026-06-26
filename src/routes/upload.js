import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { upload, uploadFile } from '../controllers/uploadController.js'

const router = Router()

router.post('/', authenticate, upload.single('file'), uploadFile)

export default router
