import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'
import * as adminController from '../controllers/adminController.js'

const router = Router()

// createReport is public (any authenticated user can report)
router.post('/reports', authenticate, adminController.createReport)

// Everything else requires admin
router.use(authenticate, requireAdmin)

router.get('/stats', adminController.getStats)
router.get('/users', adminController.getUsers)
router.put('/users/:uid/role', adminController.updateUserRole)
router.post('/users/:uid/ban', adminController.toggleBanUser)
router.get('/notes', adminController.getNotes)
router.delete('/notes/:id', adminController.deleteNote)
router.get('/reports', adminController.getReports)
router.put('/reports/:id', adminController.resolveReport)
router.get('/messages/:conversationId', adminController.getConversationMessages)
router.post('/messages', adminController.sendMessageAsAdmin)
router.delete('/messages/:id', adminController.deleteMessage)

// Help Line
router.get('/help-line/conversations', adminController.getHelpConversations)
router.get('/help-line/messages/:userId', adminController.getAdminHelpMessages)
router.post('/help-line/messages/:userId', adminController.sendAdminHelpResponse)

export default router
