<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto [align-items:safe_center]" @click.self="$emit('close')">
    <div class="w-full max-w-md bg-dathua-card border border-red-400/30 rounded-2xl p-6 shadow-2xl">
      <h2 class="font-heading text-lg font-bold text-white mb-1">Eliminar {{ site.name }}</h2>
      <p class="text-dathua-text-soft text-xs mb-4">
        Esto borra también sus {{ site.totalZones || 0 }} zona(s) y sus
        {{ site.totalNodes || 0 }} nodo(s) monitoreados. Los incidentes ya registrados se
        conservan en el historial. Esta acción no se puede deshacer.
      </p>

      <label class="block mb-4">
        <span class="block text-xs font-medium text-dathua-text-soft mb-1.5">
          Escribe <span class="text-white font-semibold">{{ site.name }}</span> para confirmar
        </span>
        <input
          v-model="confirmText"
          type="text"
          class="w-full bg-dathua-bg border border-dathua-border rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/50"
        />
      </label>

      <p v-if="error" class="text-xs text-red-400 bg-red-500/10 border border-red-400/30 rounded-lg px-3 py-2 mb-4">
        {{ error }}
      </p>

      <div class="flex items-center gap-3">
        <button
          type="button"
          class="flex-1 py-2.5 rounded-lg text-sm font-semibold text-dathua-text-soft border border-dathua-border hover:text-white hover:border-white/30 transition-colors duration-200 cursor-pointer"
          @click="$emit('close')"
        >
          Cancelar
        </button>
        <button
          type="button"
          :disabled="confirmText !== site.name || deleting"
          class="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          @click="submit"
        >
          {{ deleting ? 'Eliminando…' : 'Eliminar sucursal' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useDashboardStore } from '../../stores/dashboard'

const props = defineProps({
  site: { type: Object, required: true },
})
const emit = defineEmits(['close', 'deleted'])

const auth = useAuthStore()
const dashboard = useDashboardStore()

const confirmText = ref('')
const error = ref('')
const deleting = ref(false)

async function submit() {
  if (confirmText.value !== props.site.name) return
  deleting.value = true
  error.value = ''
  try {
    await dashboard.deleteSite(auth.token, props.site.siteId)
    emit('deleted')
  } catch (e) {
    error.value = e.message
  } finally {
    deleting.value = false
  }
}
</script>
