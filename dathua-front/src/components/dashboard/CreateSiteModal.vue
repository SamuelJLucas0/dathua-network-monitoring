<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto [align-items:safe_center]" @click.self="$emit('close')">
    <div class="w-full max-w-md bg-dathua-card border border-dathua-border rounded-2xl p-6 shadow-2xl">
      <h2 class="font-heading text-lg font-bold text-white mb-1">Nueva sucursal</h2>
      <p class="text-dathua-text-soft text-xs mb-5">
        Cada sucursal tiene su propia llave para conectar el agente que la va a monitorear.
      </p>

      <form class="space-y-4" @submit.prevent="submit">
        <TextField v-model="name" label="Nombre" placeholder="Sucursal Centro" required />
        <TextField v-model="address" label="Dirección (opcional)" placeholder="Av. Siempre Viva 123, Querétaro" />

        <p v-if="error" class="text-xs text-red-400 bg-red-500/10 border border-red-400/30 rounded-lg px-3 py-2">
          {{ error }}
        </p>

        <div class="flex items-center gap-3 pt-1">
          <button
            type="button"
            class="flex-1 py-2.5 rounded-lg text-sm font-semibold text-dathua-text-soft border border-dathua-border hover:text-white hover:border-white/30 transition-colors duration-200 cursor-pointer"
            @click="$emit('close')"
          >
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="submitting || !name.trim()"
            class="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-dathua-orange text-white hover:bg-[#B45309] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {{ submitting ? 'Creando…' : 'Crear sucursal' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useDashboardStore } from '../../stores/dashboard'
import TextField from '../form/TextField.vue'

const emit = defineEmits(['close', 'created'])

const auth = useAuthStore()
const dashboard = useDashboardStore()

const name = ref('')
const address = ref('')
const error = ref('')
const submitting = ref(false)

async function submit() {
  if (!name.value.trim()) return
  submitting.value = true
  error.value = ''
  try {
    const site = await dashboard.createSite(auth.token, {
      name: name.value.trim(),
      address: address.value.trim() || undefined,
    })
    emit('created', site)
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}
</script>
