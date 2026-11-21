<template>
  <div class="relative inline-block" v-click-outside="() => (open = false)">
    <button
      v-if="!isActive"
      type="button"
      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-dathua-text-soft border border-dathua-border hover:text-white hover:border-white/30 transition-colors duration-200 cursor-pointer"
      @click="open = !open"
    >
      <WrenchIcon class="w-3.5 h-3.5" />
      Silenciar
    </button>

    <button
      v-else
      type="button"
      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors duration-200 cursor-pointer"
      style="color: #FAB219; border-color: rgba(250,178,25,0.35); background: rgba(250,178,25,0.08);"
      :title="untilLabel"
      @click="open = !open"
    >
      <WrenchIcon class="w-3.5 h-3.5" />
      {{ untilLabel }}
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
        class="absolute right-0 top-full mt-1 w-56 bg-dathua-card border border-dathua-border rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] overflow-hidden z-30"
      >
        <div class="px-3.5 py-2.5 border-b border-dathua-border">
          <p class="text-xs font-semibold text-white">{{ label }}</p>
          <p class="text-[11px] text-dathua-text-soft mt-0.5">
            No se crearán incidentes ni notificaciones de IA mientras dure.
          </p>
        </div>

        <template v-if="!isActive">
          <button
            v-for="opt in PRESETS"
            :key="opt.minutes"
            type="button"
            :disabled="busy"
            class="w-full text-left px-3.5 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors duration-150 cursor-pointer disabled:opacity-50"
            @click="silence(opt.minutes)"
          >
            {{ opt.label }}
          </button>
          <button
            type="button"
            :disabled="busy"
            class="w-full text-left px-3.5 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors duration-150 cursor-pointer disabled:opacity-50 border-t border-dathua-border"
            @click="silence(null)"
          >
            Hasta que yo lo quite
          </button>
        </template>

        <button
          v-else
          type="button"
          :disabled="busy"
          class="w-full text-left px-3.5 py-2.5 text-sm text-white hover:bg-white/5 transition-colors duration-150 cursor-pointer disabled:opacity-50"
          @click="clear"
        >
          Quitar silencio
        </button>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, ref, h } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  maintenanceMode: { type: Boolean, default: false },
  maintenanceUntil: { type: [String, Date, null], default: null },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['silence', 'clear'])

const open = ref(false)

const PRESETS = [
  { minutes: 30, label: '30 minutos' },
  { minutes: 60, label: '1 hora' },
  { minutes: 240, label: '4 horas' },
]

const untilDate = computed(() => (props.maintenanceUntil ? new Date(props.maintenanceUntil) : null))
const isTimedActive = computed(() => untilDate.value !== null && untilDate.value.getTime() > Date.now())
const isActive = computed(() => props.maintenanceMode || isTimedActive.value)

const untilLabel = computed(() => {
  if (props.maintenanceMode) return 'En mantenimiento'
  if (isTimedActive.value) {
    const time = untilDate.value.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    return `Silenciado hasta ${time}`
  }
  return 'Silenciar'
})

function silence(minutes) {
  emit('silence', minutes)
  open.value = false
}

function clear() {
  emit('clear')
  open.value = false
}

const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (e) => {
      if (!el.contains(e.target)) binding.value(e)
    }
    document.addEventListener('click', el._clickOutside, true)
  },
  unmounted(el) {
    document.removeEventListener('click', el._clickOutside, true)
  },
}

const WrenchIcon = {
  render() {
    return h(
      'svg',
      { class: this.$attrs.class, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '1.8' },
      [h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z' })],
    )
  },
}
</script>
