import { Router } from 'express'
import { getNotifications, markAsRead } from '../controllers/notificationController.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/', authenticate, getNotifications)
router.put('/read', authenticate, markAsRead)

export default router
