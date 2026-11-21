<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto [align-items:safe_center]" @click.self="$emit('close')">
    <div class="w-full max-w-md bg-dathua-card border border-red-400/30 rounded-2xl p-6 shadow-2xl">
      <h2 class="font-heading text-lg font-bold text-white mb-1">Eliminar {{ node.name }}</h2>
      <p class="text-dathua-text-soft text-xs mb-5">
        <template v-if="childCount > 0">
          {{ childCount }} equipo(s) que dependen de este pasarán a quedar como equipos raíz — no se
          eliminan.
        </template>
        Dejará de monitorearse. Esta acción no se puede deshacer.
      </p>

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
          {{ deleting ? 'Eliminando…' : 'Eliminar equipo' }}
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
  node: { type: Object, required: true },
  childCount: { type: Number, default: 0 },
})
const emit = defineEmits(['close', 'deleted'])

const auth = useAuthStore()
const dashboard = useDashboardStore()

const error = ref('')
const deleting = ref(false)

async function submit() {
  deleting.value = true
  error.value = ''
  try {
    await dashboard.removeNode(auth.token, props.node.nodeId, props.node.siteId)
    emit('deleted')
  } catch (e) {
    error.value = e.message
  } finally {
    deleting.value = false
  }
}
</script>
