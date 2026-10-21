import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useSettingsStore } from './settings'

const MESSAGES_KEY = 'tms_messages'
const NOTIF_KEY    = 'tms_notifications'

function load(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

export const useMessagesStore = defineStore('messages', () => {
  const messages      = ref(load(MESSAGES_KEY))
  const notifications = ref(load(NOTIF_KEY))

  // ----------------------------------------------------------------
  // Direct messages
  // ----------------------------------------------------------------
  function messagesForUser(userId) {
    return messages.value
      .filter(m => m.toUserId === +userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }

  function unreadMessages(userId) {
    if (!userId) return 0
    return messages.value.filter(m => m.toUserId === +userId && !m.read).length
  }

  function sendDirectMessage(fromUser, toUser, subject, body) {
    if (!toUser) return false
    const row = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      fromUserId: fromUser?.id || 0,
      fromName: fromUser?.name || 'System',
      fromRole: fromUser?.role || 'system',
      toUserId: toUser.id,
      toUserName: toUser.name,
      subject,
      body,
      read: false,
      createdAt: new Date().toISOString()
    }
    messages.value.unshift(row)
    save(MESSAGES_KEY, messages.value)

    pushNotification('teacher', 'message', `New message: ${subject}`, 'info', { userId: toUser.id })

    try {
      useSettingsStore().audit('Send Message', 'Messages', `${fromUser?.name || 'System'} → ${toUser.name}: ${subject}`)
    } catch {}

    return true
  }

  function markMessageRead(id) {
    const m = messages.value.find(x => String(x.id) === String(id))
    if (m) {
      m.read = true
      save(MESSAGES_KEY, messages.value)
    }
  }

  // ----------------------------------------------------------------
  // Notifications
  // ----------------------------------------------------------------
  function pushNotification(target, category, message, color = 'info', meta = {}) {
    notifications.value.unshift({
      id: Date.now() + Math.floor(Math.random() * 1000),
      target,
      category,
      message,
      color,
      read: false,
      ts: new Date().toISOString(),
      userId: meta.userId || null,
      department: meta.department || null,
      teacherId: meta.teacherId || null
    })
    notifications.value = notifications.value.slice(0, 200)
    save(NOTIF_KEY, notifications.value)
  }

  function notificationsFor(user) {
    if (!user) return []
    return notifications.value.filter(n => {
      if (n.target === 'all') return true
      if (n.userId && n.userId !== user.id) return false
      if (n.target === 'admin') return user.role === 'admin'
      if (n.target === 'dept_head') {
        return user.role === 'dept_head' &&
               (!n.department || n.department === user.department)
      }
      if (n.target === 'teacher') return user.role === 'teacher' && n.userId === user.id
      if (n.target === 'class_rep') return user.role === 'class_rep'
      if (n.target === 'student') return user.role === 'student'
      return false
    })
  }

  function unreadNotifications(user) {
    return notificationsFor(user).filter(n => !n.read).length
  }

  function markNotificationRead(id) {
    const n = notifications.value.find(x => String(x.id) === String(id))
    if (n) {
      n.read = true
      save(NOTIF_KEY, notifications.value)
    }
  }

  function markAllNotificationsRead(user) {
    const mine = new Set(notificationsFor(user).map(n => n.id))
    notifications.value = notifications.value.map(n =>
      mine.has(n.id) ? { ...n, read: true } : n
    )
    save(NOTIF_KEY, notifications.value)
  }

  function clearNotifications() {
    notifications.value = []
    save(NOTIF_KEY, [])
  }

  function replaceAll({ messages: m, notifications: n }) {
    if (m) { messages.value = m; save(MESSAGES_KEY, m) }
    if (n) { notifications.value = n; save(NOTIF_KEY, n) }
  }

  return {
    messages, notifications,
    messagesForUser, unreadMessages,
    sendDirectMessage, markMessageRead,
    pushNotification, notificationsFor, unreadNotifications,
    markNotificationRead, markAllNotificationsRead, clearNotifications,
    replaceAll
  }
})