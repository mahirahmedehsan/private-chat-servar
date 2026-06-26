import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { getOnlinePresence } from '../controllers/presenceController.js'

const router = Router()

router.get('/online', authenticate, getOnlinePresence)

export default router
