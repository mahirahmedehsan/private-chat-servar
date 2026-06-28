import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'
import * as adminController from '../controllers/adminController.js'

const router = Router()

router.use(authenticate, requireAdmin)

router.get('/stats', adminController.getStats)
router.get('/users', adminController.getUsers)
router.put('/users/:uid/role', adminController.updateUserRole)
router.post('/users/:uid/ban', adminController.toggleBanUser)
router.get('/notes', adminController.getNotes)
router.delete('/notes/:id', adminController.deleteNote)
router.get('/reports', adminController.getReports)
router.post('/reports', adminController.createReport)
router.put('/reports/:id', adminController.resolveReport)
router.get('/messages/:conversationId', adminController.getConversationMessages)
router.post('/messages', adminController.sendMessageAsAdmin)
router.delete('/messages/:id', adminController.deleteMessage)

export default router
