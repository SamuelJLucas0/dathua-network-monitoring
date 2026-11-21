<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h1 class="font-heading text-2xl font-bold text-white">Historial de notificaciones</h1>
        <p class="text-dathua-text-soft text-sm mt-1">Todo lo que te hemos avisado, con opción de limpiar lo que ya no necesites.</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="notifications.unreadCount > 0"
          type="button"
          class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 cursor-pointer px-3 py-2"
          @click="markAllRead"
        >
          Marcar todas como leídas
        </button>
        <button
          v-if="notifications.historyItems.some((n) => n.isRead)"
          type="button"
          class="text-xs font-semibold text-dathua-text-soft hover:text-white transition-colors duration-200 cursor-pointer px-3 py-2"
          @click="confirmAction = 'read'"
        >
          Eliminar leídas
        </button>
        <button
          v-if="notifications.historyItems.length > 0"
          type="button"
          class="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors duration-200 cursor-pointer px-3 py-2"
          @click="confirmAction = 'all'"
        >
          Eliminar todo
        </button>
      </div>
    </div>

    <div v-if="initialLoading" class="flex items-center justify-center py-24">
      <span class="w-8 h-8 rounded-full border-2 border-dathua-border border-t-dathua-orange animate-spin"></span>
    </div>

    <div v-else-if="notifications.historyItems.length === 0" class="bg-dathua-card border border-dathua-border rounded-2xl">
      <EmptyState
        icon="bell"
        size="lg"
        title="No tienes notificaciones en tu historial"
        description="Aquí aparecerá todo lo que te avisemos sobre tus sucursales."
      />
    </div>

    <div v-else class="bg-dathua-card border border-dathua-border rounded-2xl overflow-hidden">
      <div
        v-for="n in notifications.historyItems"
        :key="n.notificationId"
        class="group flex items-start gap-3 px-5 py-4 border-b border-dathua-border last:border-0"
        :class="!n.isRead && 'bg-white/[0.03]'"
      >
        <span class="w-2 h-2 rounded-full shrink-0 mt-1.5" :style="{ backgroundColor: severityColor(n.severity) }"></span>
        <button type="button" class="text-left min-w-0 flex-1 cursor-pointer" @click="openNotification(n)">
          <p class="text-sm" :class="n.isRead ? 'text-gray-300' : 'text-white font-medium'">{{ n.title }}</p>
          <p class="text-xs text-dathua-text-soft mt-0.5">{{ n.message }}</p>
          <p class="text-[11px] text-dathua-text-soft/70 mt-1.5">{{ formatRelativeTime(n.createdAt) }}</p>
        </button>
        <span v-if="!n.isRead" class="w-1.5 h-1.5 rounded-full bg-dathua-orange shrink-0 mt-2"></span>
        <button
          type="button"
          title="Eliminar"
          class="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-dathua-text-soft/50 hover:text-white hover:bg-white/10 transition-colors duration-150 cursor-pointer"
          @click="removeOne(n)"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>

    <div v-if="!initialLoading && notifications.historyHasMore" class="flex justify-center">
      <button
        type="button"
        :disabled="notifications.historyLoading"
        class="px-4 py-2.5 rounded-lg text-sm font-semibold text-dathua-text-soft border border-dathua-border hover:text-white hover:border-dathua-orange/40 transition-colors duration-200 cursor-pointer disabled:opacity-50"
        @click="notifications.fetchHistoryPage(auth.token)"
      >
        {{ notifications.historyLoading ? 'Cargando…' : 'Cargar más' }}
      </button>
    </div>

    <ConfirmDialog
      v-if="confirmAction"
      :title="confirmAction === 'all' ? 'Eliminar todo el historial' : 'Eliminar notificaciones leídas'"
      :message="confirmAction === 'all'
        ? 'Se borrarán todas tus notificaciones, leídas y sin leer. Esta acción no se puede deshacer.'
        : 'Se borrarán las notificaciones que ya marcaste como leídas. Esta acción no se puede deshacer.'"
      :loading="deleting"
      @cancel="confirmAction = null"
      @confirm="runBulkDelete"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notifications'
import { ROLE_COLOR } from '../../utils/status'
import { formatRelativeTime } from '../../utils/time'
import ConfirmDialog from '../../components/dashboard/ConfirmDialog.vue'
import EmptyState from '../../components/dashboard/EmptyState.vue'

const router = useRouter()
const auth = useAuthStore()
const notifications = useNotificationStore()

const initialLoading = ref(false)
const confirmAction = ref(null)
const deleting = ref(false)

function severityColor(severity) {
  const map = { CRITICAL: ROLE_COLOR.critical, HIGH: ROLE_COLOR.serious, MEDIUM: ROLE_COLOR.warning, LOW: ROLE_COLOR.neutral, INFO: ROLE_COLOR.neutral }
  return map[String(severity).toUpperCase()] || ROLE_COLOR.neutral
}

async function markAllRead() {
  await notifications.markAllRead(auth.token)
}

async function removeOne(n) {
  await notifications.deleteOne(auth.token, n.notificationId)
}

async function openNotification(n) {
  if (!n.isRead) await notifications.markRead(auth.token, n.notificationId)
  router.push(n.link || '/dashboard/incidents')
}

async function runBulkDelete() {
  deleting.value = true
  try {
    await notifications.deleteAll(auth.token, { onlyRead: confirmAction.value === 'read' })
    confirmAction.value = null
  } finally {
    deleting.value = false
  }
}

onMounted(async () => {
  // Siempre se recarga desde el principio al entrar a esta vista — es una
  // página de historial, no queremos mezclar una sesión vieja de scroll
  // con notificaciones nuevas que llegaron desde entonces.
  notifications.resetHistory()
  initialLoading.value = true
  try {
    await notifications.fetchHistoryPage(auth.token)
  } finally {
    initialLoading.value = false
  }
})
</script>
