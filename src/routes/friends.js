import { Router } from 'express'
import {
  getFriends,
  sendRequest,
  respondToRequest,
  removeFriend,
  blockUser,
  unblockUser,
  getFriendStatus,
  getBlockedList,
} from '../controllers/friendController.js'
import { authenticate } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validate.js'

const router = Router()

router.get('/', authenticate, getFriends)
router.post('/request', authenticate, validate(schemas.friendRequest), sendRequest)
router.put('/respond', authenticate, validate(schemas.friendResponse), respondToRequest)
router.delete('/:id', authenticate, removeFriend)
router.post('/block/:id', authenticate, blockUser)
router.post('/unblock/:id', authenticate, unblockUser)
router.get('/status/:id', authenticate, getFriendStatus)
router.get('/blocked', authenticate, getBlockedList)

export default router
