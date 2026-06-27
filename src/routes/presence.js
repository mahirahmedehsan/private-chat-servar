import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { getOnlinePresence, getBatchStatus, heartbeat } from '../controllers/presenceController.js'

const router = Router()

router.get('/online', authenticate, getOnlinePresence)
router.get('/status', authenticate, getBatchStatus)
router.post('/heartbeat', authenticate, heartbeat)

export default router
