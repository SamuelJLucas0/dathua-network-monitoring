<template>
  <div class="relative" @click.stop>
    <button
      type="button"
      class="w-7 h-7 rounded-lg flex items-center justify-center text-dathua-text-soft hover:text-white hover:bg-white/5 transition-colors duration-150 shrink-0 cursor-pointer"
      @click="open = !open"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6h.01M12 12h.01M12 18h.01" />
      </svg>
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
        v-click-outside="() => (open = false)"
        class="absolute right-0 top-full mt-1 w-44 bg-dathua-card border border-dathua-border rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] overflow-hidden z-30"
      >
        <button type="button" class="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors duration-150 cursor-pointer" @click="emitAndClose('edit')">
          Editar
        </button>
        <button type="button" class="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors duration-150 cursor-pointer" @click="emitAndClose('apikey')">
          Ver llave de API
        </button>
        <button type="button" class="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors duration-150 cursor-pointer" @click="emitAndClose('delete')">
          Eliminar
        </button>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['edit', 'apikey', 'delete'])
const open = ref(false)

function emitAndClose(action) {
  open.value = false
  emit(action)
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
</script>
