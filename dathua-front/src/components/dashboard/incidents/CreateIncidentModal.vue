<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto [align-items:safe_center]" @click.self="$emit('close')">
    <div class="w-full max-w-lg max-h-[88vh] overflow-y-auto bg-dathua-card border border-dathua-border rounded-2xl p-6 shadow-2xl">
      <h2 class="font-heading text-lg font-bold text-white mb-1">Nuevo incidente</h2>
      <p class="text-dathua-text-soft text-xs mb-5">
        Regístralo a mano cuando detectes algo que el monitoreo automático todavía no marcó.
      </p>

      <form class="space-y-4" @submit.prevent="submit">
        <label class="block">
          <span class="block text-xs font-medium text-dathua-text-soft mb-1.5">Equipo afectado</span>
          <select v-model="nodeId" required class="w-full bg-dathua-bg border border-dathua-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-dathua-orange">
            <option value="" disabled>Selecciona un equipo</option>
            <option v-for="n in nodes" :key="n.nodeId" :value="n.nodeId">{{ n.name }}</option>
          </select>
        </label>

        <label class="block">
          <span class="block text-xs font-medium text-dathua-text-soft mb-1.5">Severidad</span>
          <select v-model="severity" class="w-full bg-dathua-bg border border-dathua-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-dathua-orange">
            <option v-for="s in SEVERITIES" :key="s" :value="s">{{ SEVERITY[s].label }}</option>
          </select>
        </label>

        <TextField v-model="title" label="Título" placeholder="Cámara de entrada sin respuesta" required />

        <label class="block">
          <span class="block text-xs font-medium text-dathua-text-soft mb-1.5">Descripción</span>
          <textarea
            v-model="message"
            rows="3"
            required
            placeholder="Qué pasó, desde cuándo, y cualquier detalle útil para dar seguimiento."
            class="w-full bg-dathua-bg border border-dathua-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-dathua-orange resize-none"
          ></textarea>
        </label>

        <p v-if="error" class="text-xs text-red-400 bg-red-500/10 border border-red-400/30 rounded-lg px-3 py-2">
          {{ error }}
        </p>

        <div class="flex items-center gap-3 pt-1">
          <button type="button" class="flex-1 py-2.5 rounded-lg text-sm font-semibold text-dathua-text-soft border border-dathua-border hover:text-white hover:border-white/30 transition-colors duration-200 cursor-pointer" @click="$emit('close')">
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="submitting || !nodeId || !title.trim() || !message.trim()"
            class="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-dathua-orange text-white hover:bg-[#B45309] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {{ submitting ? 'Guardando…' : 'Crear incidente' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../../../stores/auth'
import * as api from '../../../services/api'
import { SEVERITY } from '../../../utils/status'
import TextField from '../../form/TextField.vue'

const props = defineProps({
  siteId: { type: [Number, String], required: true },
  nodes: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'created'])

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']

const auth = useAuthStore()

const nodeId = ref('')
const severity = ref('MEDIUM')
const title = ref('')
const message = ref('')
const error = ref('')
const submitting = ref(false)

async function submit() {
  if (!nodeId.value || !title.value.trim() || !message.value.trim()) return
  submitting.value = true
  error.value = ''
  try {
    await api.createIncident(auth.token, {
      nodeId: nodeId.value,
      siteId: props.siteId,
      severity: severity.value,
      title: title.value.trim(),
      message: message.value.trim(),
    })
    emit('created')
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}
</script>
