<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto [align-items:safe_center]" @click.self="$emit('close')">
    <div class="w-full max-w-md bg-dathua-card border border-dathua-border rounded-2xl p-6 shadow-2xl">
      <h2 class="font-heading text-lg font-bold text-white mb-1">Llave de {{ site.name }}</h2>
      <p class="text-dathua-text-soft text-xs mb-5">
        Úsala para conectar o reinstalar el agente de esta sucursal. No la compartas fuera de tu equipo.
      </p>

      <div v-if="loading" class="h-11 rounded-lg bg-dathua-bg border border-dathua-border animate-pulse"></div>
      <div v-else-if="error" class="text-xs text-red-400 bg-red-500/10 border border-red-400/30 rounded-lg px-3 py-2">
        {{ error }}
      </div>
      <div v-else class="flex items-center gap-2">
        <code class="flex-1 min-w-0 truncate bg-dathua-bg border border-dathua-border rounded-lg px-3 py-2.5 text-xs text-dathua-orange font-mono">
          {{ apiKey }}
        </code>
        <button
          type="button"
          class="shrink-0 text-xs font-semibold text-dathua-text-soft border border-dathua-border rounded-lg px-3 py-2.5 hover:text-white hover:border-white/30 transition-colors duration-200 cursor-pointer"
          @click="copyKey"
        >
          {{ copied ? 'Copiada' : 'Copiar' }}
        </button>
      </div>

      <button
        type="button"
        class="w-full mt-5 py-2.5 rounded-lg text-sm font-semibold text-dathua-text-soft border border-dathua-border hover:text-white hover:border-white/30 transition-colors duration-200 cursor-pointer"
        @click="$emit('close')"
      >
        Cerrar
      </button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { getSiteApiKey } from '../../services/api'
import { copyText } from '../../utils/clipboard'

const props = defineProps({
  site: { type: Object, required: true },
})
defineEmits(['close'])

const auth = useAuthStore()
const apiKey = ref('')
const loading = ref(true)
const error = ref('')
const copied = ref(false)

onMounted(async () => {
  try {
    apiKey.value = await getSiteApiKey(auth.token, props.site.siteId)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

async function copyKey() {
  try {
    await copyText(apiKey.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    error.value = 'No se pudo copiar automáticamente — selecciónala a mano.'
  }
}
</script>
