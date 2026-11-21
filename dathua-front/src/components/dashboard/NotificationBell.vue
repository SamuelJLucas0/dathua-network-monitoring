<template>
  <div class="relative">
    <button
      type="button"
      class="relative w-10 h-10 rounded-full flex items-center justify-center text-dathua-text-soft hover:text-white hover:bg-white/5 transition-colors duration-200"
      title="Notificaciones"
      @click="toggle"
    >
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      <span
        v-if="store.unreadCount > 0"
        class="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-dathua-orange text-white text-[10px] font-bold flex items-center justify-center leading-none"
      >
        {{ store.unreadCount > 9 ? '9+' : store.unreadCount }}
      </span>
    </button>

    <transition
      enter-active-class="transition-all duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="open"
        class="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-dathua-card border border-dathua-border rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] overflow-hidden z-30"
      >
        <div class="flex items-center justify-between px-4 py-3 border-b border-dathua-border">
          <p class="text-sm font-semibold text-white">Notificaciones</p>
          <button
            v-if="store.unreadCount > 0"
            type="button"
            class="text-xs font-medium text-dathua-orange hover:text-white transition-colors duration-150 cursor-pointer"
            @click="markAllRead"
          >
            Marcar todas como leídas
          </button>
        </div>

        <div class="max-h-96 overflow-y-auto">
          <div v-if="store.items.length === 0" class="py-10 text-center text-sm text-dathua-text-soft">
            No tienes notificaciones.
          </div>
          <div
            v-for="n in store.items"
            :key="n.notificationId"
            class="group w-full flex items-start gap-2.5 px-4 py-3 border-b border-dathua-border last:border-0 hover:bg-white/5 transition-colors duration-150"
            :class="!n.isRead && 'bg-white/[0.03]'"
          >
            <button type="button" class="flex items-start gap-2.5 text-left min-w-0 flex-1 cursor-pointer" @click="openNotification(n)">
              <span class="w-2 h-2 rounded-full shrink-0 mt-1.5" :style="{ backgroundColor: severityColor(n.severity) }"></span>
              <div class="min-w-0 flex-1">
                <p class="text-sm truncate" :class="n.isRead ? 'text-gray-300' : 'text-white font-medium'">{{ n.title }}</p>
                <p class="text-xs text-dathua-text-soft truncate mt-0.5">{{ n.message }}</p>
                <p class="text-[11px] text-dathua-text-soft/70 mt-1">{{ formatRelativeTime(n.createdAt) }}</p>
              </div>
            </button>
            <span v-if="!n.isRead" class="w-1.5 h-1.5 rounded-full bg-dathua-orange shrink-0 mt-2"></span>
            <button
              type="button"
              title="Eliminar"
              class="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-dathua-text-soft/50 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer"
              @click.stop="removeNotification(n)"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div class="flex items-center border-t border-dathua-border">
          <router-link
            to="/dashboard/notifications"
            class="flex-1 text-center text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-150 py-2.5 border-r border-dathua-border"
            @click="close"
          >
            Ver historial
          </router-link>
          <router-link
            to="/dashboard/profile?tab=notifications"
            class="flex-1 text-center text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-150 py-2.5"
            @click="close"
          >
            Configurar
          </router-link>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notifications'
import { ROLE_COLOR } from '../../utils/status'
import { formatRelativeTime } from '../../utils/time'

const router = useRouter()
const auth = useAuthStore()
const store = useNotificationStore()

const open = ref(false)

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function severityColor(severity) {
  const map = { CRITICAL: ROLE_COLOR.critical, HIGH: ROLE_COLOR.serious, MEDIUM: ROLE_COLOR.warning, LOW: ROLE_COLOR.neutral, INFO: ROLE_COLOR.neutral }
  return map[String(severity).toUpperCase()] || ROLE_COLOR.neutral
}

async function markAllRead() {
  await store.markAllRead(auth.token)
}

async function removeNotification(n) {
  await store.deleteOne(auth.token, n.notificationId)
}

async function openNotification(n) {
  close()
  if (!n.isRead) await store.markRead(auth.token, n.notificationId)
  router.push(n.link || '/dashboard/incidents')
}
</script>
