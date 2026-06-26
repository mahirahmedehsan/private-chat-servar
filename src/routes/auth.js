import { Router } from 'express'
import { googleAuth, emailRegister, emailLogin, refreshToken, logout } from '../controllers/authController.js'
import { validate, schemas } from '../middleware/validate.js'
import { authLimiter } from '../middleware/rateLimiter.js'

const router = Router()

router.post('/google', authLimiter, googleAuth)
router.post('/register', authLimiter, validate(schemas.register), emailRegister)
router.post('/login', authLimiter, validate(schemas.login), emailLogin)
router.post('/refresh', refreshToken)
router.post('/logout', logout)

export default router
