import { Router } from 'express'
import { getMessages, sendMessage, editMessage, deleteMessage, toggleReaction } from '../controllers/messageController.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/:conversationId', authenticate, getMessages)
router.post('/', authenticate, sendMessage)
router.put('/:id', authenticate, editMessage)
router.delete('/:id', authenticate, deleteMessage)
router.put('/:id/reaction', authenticate, toggleReaction)

export default router
