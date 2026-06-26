import { getOnlineUsers } from '../sockets/index.js'

export function getOnlinePresence(req, res) {
  const onlineUids = [...getOnlineUsers()]
  res.json({ online: onlineUids })
}
