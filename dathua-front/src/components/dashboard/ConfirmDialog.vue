<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto [align-items:safe_center]" @click.self="$emit('cancel')">
    <div class="w-full max-w-md bg-dathua-card rounded-2xl p-6 shadow-2xl" :class="tone === 'danger' ? 'border border-red-400/30' : 'border border-dathua-border'">
      <div class="flex items-start gap-3 mb-1">
        <span
          class="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          :class="tone === 'danger' ? 'bg-red-500/10 text-red-400' : 'bg-dathua-orange/10 text-dathua-orange'"
        >
          <svg class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path v-if="tone === 'danger'" stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
            <path v-else stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <div class="min-w-0">
          <h2 class="font-heading text-lg font-bold text-white">{{ title }}</h2>
          <p class="text-dathua-text-soft text-xs mt-1">{{ message }}</p>
        </div>
      </div>

      <div class="flex items-center gap-3 mt-5">
        <button type="button" class="flex-1 py-2.5 rounded-lg text-sm font-semibold text-dathua-text-soft border border-dathua-border hover:text-white hover:border-white/30 transition-colors duration-200 cursor-pointer" @click="$emit('cancel')">
          Cancelar
        </button>
        <button
          type="button"
          :disabled="loading"
          class="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          :class="tone === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-dathua-orange hover:bg-[#B45309]'"
          @click="$emit('confirm')"
        >
          {{ loading ? loadingLabel : confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  message: { type: String, default: 'Esta acción no se puede deshacer.' },
  confirmLabel: { type: String, default: 'Eliminar' },
  // 'danger' (rojo, default — usado para eliminar) o 'warning' (naranja de
  // marca — usado para acciones en lote que no borran nada, como "Marcar
  // todo como resuelto").
  tone: { type: String, default: 'danger' },
  loading: { type: Boolean, default: false },
})
defineEmits(['confirm', 'cancel'])

const loadingLabel = computed(() => (props.tone === 'danger' ? 'Eliminando…' : `${props.confirmLabel}…`))
</script>
