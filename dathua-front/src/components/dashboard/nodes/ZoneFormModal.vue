<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto [align-items:safe_center]" @click.self="$emit('close')">
    <div class="w-full max-w-md bg-dathua-card border border-dathua-border rounded-2xl p-6 shadow-2xl">
      <h2 class="font-heading text-lg font-bold text-white mb-1">{{ isEdit ? 'Editar zona' : 'Nueva zona' }}</h2>
      <p class="text-dathua-text-soft text-xs mb-5">
        Una zona agrupa equipos dentro de {{ site.name }} (ej. "Piso 1", "Área de cajas").
      </p>

      <form class="space-y-4" @submit.prevent="submit">
        <TextField v-model="name" label="Nombre de la zona" placeholder="Piso 1" required />
        <TextField v-model="description" label="Descripción (opcional)" placeholder="Cajas y área de venta" />

        <div>
          <label class="block text-xs font-medium text-dathua-text-soft mb-1.5">Ícono</label>
          <div class="grid grid-cols-6 gap-1.5">
            <button
              v-for="opt in ZONE_ICON_TYPES"
              :key="opt"
              type="button"
              :title="ZONE_ICON_LABELS[opt]"
              class="aspect-square rounded-lg border flex items-center justify-center p-2 transition-colors duration-200 cursor-pointer"
              :class="icon === opt
                ? 'border-dathua-orange bg-dathua-orange/10 text-dathua-orange'
                : 'border-dathua-border text-dathua-text-soft hover:border-white/30 hover:text-white'"
              @click="icon = opt"
            >
              <span class="w-full h-full" v-html="ZONE_ICONS[opt]"></span>
            </button>
          </div>
        </div>

        <p v-if="error" class="text-xs text-red-400 bg-red-500/10 border border-red-400/30 rounded-lg px-3 py-2">
          {{ error }}
        </p>

        <div class="flex items-center gap-3 pt-1">
          <button type="button" class="flex-1 py-2.5 rounded-lg text-sm font-semibold text-dathua-text-soft border border-dathua-border hover:text-white hover:border-white/30 transition-colors duration-200 cursor-pointer" @click="$emit('close')">
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="submitting || !name.trim()"
            class="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-dathua-orange text-white hover:bg-[#B45309] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {{ submitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear zona' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useAuthStore } from '../../../stores/auth'
import { useDashboardStore } from '../../../stores/dashboard'
import TextField from '../../form/TextField.vue'
import { ZONE_ICONS, ZONE_ICON_TYPES, ZONE_ICON_LABELS } from '../../../utils/zoneIcons'

const props = defineProps({
  site: { type: Object, required: true },
  zone: { type: Object, default: null },
})
const emit = defineEmits(['close', 'created', 'saved'])

const auth = useAuthStore()
const dashboard = useDashboardStore()

const isEdit = computed(() => Boolean(props.zone))

const name = ref(props.zone?.name || '')
const description = ref(props.zone?.description || '')
const icon = ref(props.zone?.icon || 'building')
const error = ref('')
const submitting = ref(false)

async function submit() {
  if (!name.value.trim()) return
  submitting.value = true
  error.value = ''
  const payload = { name: name.value.trim(), description: description.value.trim() || null, icon: icon.value }
  try {
    if (isEdit.value) {
      await dashboard.editZone(auth.token, props.zone.zoneId, props.site.siteId, payload)
      emit('saved')
    } else {
      await dashboard.createZone(auth.token, props.site.siteId, payload)
      emit('created')
    }
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}
</script>
