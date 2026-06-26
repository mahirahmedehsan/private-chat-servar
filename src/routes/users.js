import { Router } from 'express'
import { getProfile, updateProfile, getUserByUid, getUserProfile, getProfileStats, searchUsers } from '../controllers/userController.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/me', authenticate, getProfile)
router.get('/me/stats', authenticate, getProfileStats)
router.put('/me', authenticate, updateProfile)
router.get('/search', authenticate, searchUsers)
router.get('/:uid/profile', authenticate, getUserProfile)
router.get('/:uid', authenticate, getUserByUid)

export default router
