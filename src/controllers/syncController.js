import SyncMetadata from '../models/SyncMetadata.js'
import * as syncDb from '../services/syncDb.js'

export async function initSync(req, res, next) {
  try {
    const { deviceId, driveFolderId } = req.body
    let metadata = await SyncMetadata.findOne({
      userId: req.user.uid,
      deviceId,
    })

    if (!metadata) {
      metadata = await SyncMetadata.create({
        userId: req.user.uid,
        deviceId,
        lastSyncTimestamp: new Date(0),
      })
    }

    try {
      await syncDb.setSyncState(req.user.uid, deviceId, {
        deviceId,
        lastSyncTimestamp: metadata.lastSyncTimestamp?.toISOString() || new Date(0).toISOString(),
        driveFileVersion: metadata.driveFileVersion || 0,
        lastDriveFileId: metadata.lastDriveFileId || null,
        online: true,
        lastSeen: Date.now(),
      })
    } catch {
      console.warn('[Sync] RTDB unavailable — sync state not cached')
    }

    res.json(metadata)
  } catch (error) {
    next(error)
  }
}

export async function getChanges(req, res, next) {
  try {
    const { since } = req.query
    const timestamp = since ? new Date(since) : new Date(0)

    const metadata = await SyncMetadata.findOne({
      userId: req.user.uid,
      deviceId: req.query.deviceId,
    })

    let pending = []
    try {
      pending = await syncDb.getPendingChanges(req.user.uid)
    } catch {
      console.warn('[Sync] RTDB unavailable — pending changes not loaded')
    }

    if (!metadata) {
      return res.json({ changes: pending, lastSync: null })
    }

    res.json({
      lastSync: metadata.lastSyncTimestamp,
      driveFileVersion: metadata.driveFileVersion,
      lastDriveFileId: metadata.lastDriveFileId,
      pending,
    })
  } catch (error) {
    next(error)
  }
}

export async function resolveSync(req, res, next) {
  try {
    const { deviceId, lastSyncTimestamp, driveFileVersion, lastDriveFileId } = req.body

    const metadata = await SyncMetadata.findOneAndUpdate(
      { userId: req.user.uid, deviceId },
      { lastSyncTimestamp, driveFileVersion, lastDriveFileId },
      { upsert: true, new: true }
    )

    try {
      await syncDb.setSyncState(req.user.uid, deviceId, {
        lastSyncTimestamp,
        driveFileVersion,
        lastDriveFileId,
        lastSeen: Date.now(),
      })
    } catch {
      console.warn('[Sync] RTDB unavailable — state not synced')
    }

    res.json(metadata)
  } catch (error) {
    next(error)
  }
}

export async function pushChange(req, res, next) {
  try {
    const { type, data } = req.body
    if (!type || !data) {
      return res.status(400).json({ error: { message: 'type and data required' } })
    }

    let changeId = null
    try {
      changeId = await syncDb.addPendingChange(req.user.uid, {
        type,
        data,
        userId: req.user.uid,
      })
    } catch {
      return res.status(503).json({ error: { message: 'Sync service unavailable' } })
    }

    res.status(201).json({ id: changeId })
  } catch (error) {
    next(error)
  }
}

export async function getBackups(req, res, next) {
  try {
    const limit = parseInt(req.query.limit, 10) || 20
    let backups = []
    try {
      backups = await syncDb.getBackups(req.user.uid, limit)
    } catch {
      return res.json({ backups: [] })
    }
    res.json({ backups })
  } catch (error) {
    next(error)
  }
}

export async function deviceOffline(req, res, next) {
  try {
    const { deviceId } = req.body
    try {
      await syncDb.setSyncState(req.user.uid, deviceId, { online: false, lastSeen: Date.now() })
    } catch {}
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
}

export async function listDevices(req, res, next) {
  try {
    let devices = []
    try {
      devices = await syncDb.getAllDevices(req.user.uid)
    } catch {}
    res.json({ devices })
  } catch (error) {
    next(error)
  }
}
