<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto [align-items:safe_center]" @click.self="$emit('close')">
    <div class="w-full max-w-md bg-dathua-card border border-red-400/30 rounded-2xl p-6 shadow-2xl">
      <h2 class="font-heading text-lg font-bold text-white mb-1">Eliminar zona {{ zone.name }}</h2>
      <p class="text-dathua-text-soft text-xs mb-4">Esta acción no se puede deshacer.</p>

      <label class="flex items-start gap-2.5 mb-5 cursor-pointer">
        <input v-model="deleteNodes" type="checkbox" class="w-4 h-4 rounded accent-red-500 mt-0.5" />
        <span class="text-sm text-gray-300">
          También eliminar sus {{ zone.totalNodes || 0 }} equipo(s)
          <span class="block text-xs text-dathua-text-soft mt-0.5">
            Si lo dejas sin marcar, los equipos se conservan sin zona asignada.
          </span>
        </span>
      </label>

      <p v-if="error" class="text-xs text-red-400 bg-red-500/10 border border-red-400/30 rounded-lg px-3 py-2 mb-4">
        {{ error }}
      </p>

      <div class="flex items-center gap-3">
        <button type="button" class="flex-1 py-2.5 rounded-lg text-sm font-semibold text-dathua-text-soft border border-dathua-border hover:text-white hover:border-white/30 transition-colors duration-200 cursor-pointer" @click="$emit('close')">
          Cancelar
        </button>
        <button
          type="button"
          :disabled="deleting"
          class="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          @click="submit"
        >
          {{ deleting ? 'Eliminando…' : 'Eliminar zona' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../../../stores/auth'
import { useDashboardStore } from '../../../stores/dashboard'

const props = defineProps({
  zone: { type: Object, required: true },
  siteId: { type: Number, required: true },
})
const emit = defineEmits(['close', 'deleted'])

const auth = useAuthStore()
const dashboard = useDashboardStore()

const deleteNodes = ref(false)
const error = ref('')
const deleting = ref(false)

async function submit() {
  deleting.value = true
  error.value = ''
  try {
    await dashboard.removeZone(auth.token, props.zone.zoneId, props.siteId, deleteNodes.value)
    emit('deleted')
  } catch (e) {
    error.value = e.message
  } finally {
    deleting.value = false
  }
}
</script>
