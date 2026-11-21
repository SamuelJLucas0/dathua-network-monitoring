import { defineStore } from 'pinia'
import * as api from '../services/api'

const HISTORY_PAGE_SIZE = 20

export const useNotificationStore = defineStore('notifications', {
  state: () => ({
    items: [],
    unreadCount: 0,
    loaded: false,
    // Estado aparte para la página de "Historial de notificaciones" — la
    // campanita solo necesita las últimas 10, el historial pagina de a
    // HISTORY_PAGE_SIZE y no debe pisar lo que la campanita ya tiene cargado.
    historyItems: [],
    historyLoading: false,
    historyHasMore: true,
  }),

  actions: {
    async fetchRecent(token) {
      const [items, unread] = await Promise.all([
        api.getNotifications(token, { limit: 10 }),
        api.getUnreadNotificationCount(token),
      ])
      this.items = items
      this.unreadCount = unread.count
      this.loaded = true
    },

    // Llega por Socket.IO en cuanto se crea un incidente que le importa a
    // este usuario (ver notificationService.js en el backend) — no hace
    // falta esperar a que alguien recargue la página.
    receiveLive(notification) {
      this.items = [notification, ...this.items].slice(0, 10)
      this.unreadCount++
      // Si el historial ya está abierto y al día, refleja la nueva también
      // ahí — evita que el historial se vea desactualizado sin recargar.
      if (this.historyItems.length > 0) {
        this.historyItems = [notification, ...this.historyItems]
      }
    },

    async markRead(token, notificationId) {
      const item = this.items.find((n) => n.notificationId === notificationId)
      if (item && !item.isRead) {
        item.isRead = true
        this.unreadCount = Math.max(0, this.unreadCount - 1)
      }
      const histItem = this.historyItems.find((n) => n.notificationId === notificationId)
      if (histItem) histItem.isRead = true
      await api.markNotificationRead(token, notificationId)
    },

    async markAllRead(token) {
      this.items.forEach((n) => (n.isRead = true))
      this.historyItems.forEach((n) => (n.isRead = true))
      this.unreadCount = 0
      await api.markAllNotificationsRead(token)
    },

    // Borra una notificación de verdad (no solo marcarla leída) — pedido
    // explícitamente porque antes no había forma de limpiar el historial,
    // solo de marcarlo como leído para siempre.
    async deleteOne(token, notificationId) {
      const wasUnread = this.items.some((n) => n.notificationId === notificationId && !n.isRead)
        || this.historyItems.some((n) => n.notificationId === notificationId && !n.isRead)
      this.items = this.items.filter((n) => n.notificationId !== notificationId)
      this.historyItems = this.historyItems.filter((n) => n.notificationId !== notificationId)
      if (wasUnread) this.unreadCount = Math.max(0, this.unreadCount - 1)
      await api.deleteNotification(token, notificationId)
    },

    // `onlyRead`: true borra solo las ya leídas (opción conservadora desde
    // la campanita); false/omitido borra el historial completo del usuario
    // (botón "Eliminar todas" en la página de historial).
    async deleteAll(token, { onlyRead } = {}) {
      await api.deleteAllNotifications(token, onlyRead ? { onlyRead: true } : undefined)
      if (onlyRead) {
        this.items = this.items.filter((n) => !n.isRead)
        this.historyItems = this.historyItems.filter((n) => !n.isRead)
      } else {
        this.items = []
        this.historyItems = []
        this.unreadCount = 0
        this.historyHasMore = false
      }
    },

    async fetchHistoryPage(token) {
      if (this.historyLoading || !this.historyHasMore) return
      this.historyLoading = true
      try {
        const page = await api.getNotifications(token, {
          limit: HISTORY_PAGE_SIZE,
          offset: this.historyItems.length,
        })
        this.historyItems = [...this.historyItems, ...page]
        this.historyHasMore = page.length === HISTORY_PAGE_SIZE
      } finally {
        this.historyLoading = false
      }
    },

    resetHistory() {
      this.historyItems = []
      this.historyHasMore = true
    },

    reset() {
      this.$reset()
    },
  },
})
