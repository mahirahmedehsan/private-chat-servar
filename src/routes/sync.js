import { Router } from 'express'
import { initSync, getChanges, resolveSync, pushChange, getBackups, deviceOffline, listDevices } from '../controllers/syncController.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.post('/init', authenticate, initSync)
router.get('/changes', authenticate, getChanges)
router.post('/resolve', authenticate, resolveSync)
router.post('/push', authenticate, pushChange)
router.get('/backups', authenticate, getBackups)
router.post('/offline', authenticate, deviceOffline)
router.get('/devices', authenticate, listDevices)

export default router
