<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto [align-items:safe_center]" @click.self="$emit('close')">
    <div class="w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-dathua-card border border-dathua-border rounded-2xl p-5 shadow-2xl">
      <h2 class="font-heading text-lg font-bold text-white mb-1">
        {{ isEdit ? 'Editar equipo' : isApproving ? 'Aprobar equipo descubierto' : 'Nuevo equipo' }}
      </h2>
      <p class="text-dathua-text-soft text-xs mb-4">
        {{ isEdit
          ? `Actualiza los datos de ${node.name}.`
          : isApproving
            ? `Se agregará a ${site.name} con la IP/MAC que ya detectó el agente.`
            : `Se agregará a ${site.name}.` }}
      </p>

      <form class="space-y-3" @submit.prevent="submit">
        <TextField v-model="name" label="Nombre del equipo" placeholder="Router principal" required />

        <div>
          <span class="block text-xs font-medium text-dathua-text-soft mb-1.5">Tipo de equipo</span>
          <div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            <button
              v-for="opt in deviceTypes"
              :key="opt"
              type="button"
              class="flex flex-col items-center gap-1 py-2 rounded-lg border transition-colors duration-150 cursor-pointer"
              :class="deviceType === opt
                ? 'border-dathua-orange bg-dathua-orange/10 text-dathua-orange'
                : 'border-dathua-border text-dathua-text-soft hover:text-white hover:border-white/30'"
              @click="deviceType = opt"
            >
              <span class="w-4 h-4" v-html="DEVICE_ICONS[opt]"></span>
              <span class="text-[10px] leading-tight text-center">{{ formatDeviceType(opt) }}</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextField
            v-model="ipAddress"
            label="Dirección IP"
            placeholder="192.168.1.1"
            required
            :disabled="isApproving"
            :error="ipTouched ? ipErrorMsg : ''"
            @blur="ipTouched = true"
          />

          <TextField
            v-model="macAddress"
            label="Dirección MAC (opcional)"
            placeholder="AA:BB:CC:DD:EE:FF"
            :disabled="isApproving"
            :error="macTouched ? macErrorMsg : ''"
            @blur="macTouched = true"
          />
        </div>
        <p v-if="isApproving" class="text-[11px] text-dathua-text-soft -mt-2">
          IP y MAC vienen del descubrimiento del agente y no se pueden editar aquí — si están mal, ignora este
          candidato y da de alta el equipo a mano con los datos correctos.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="block">
            <span class="block text-xs font-medium text-dathua-text-soft mb-1.5">Zona (opcional)</span>
            <select v-model="zoneId" class="w-full bg-dathua-bg border border-dathua-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-dathua-orange">
              <option value="">Sin zona</option>
              <option v-for="z in zones" :key="z.zoneId" :value="z.zoneId">{{ z.name }}</option>
            </select>
          </label>

          <label class="block">
            <span class="block text-xs font-medium text-dathua-text-soft mb-1.5">Depende de (opcional)</span>
            <select v-model="parentNodeId" class="w-full bg-dathua-bg border border-dathua-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-dathua-orange">
              <option value="">Ninguno — es raíz</option>
              <option v-for="n in availableParents" :key="n.nodeId" :value="n.nodeId">{{ n.name }}</option>
            </select>
          </label>
        </div>
        <p class="text-[11px] text-dathua-text-soft -mt-2">
          "Depende de" es el equipo del que cuelga (ej. una cámara conectada a un switch) — ayuda a priorizar alertas.
        </p>

        <div class="flex items-center justify-between gap-3 flex-wrap border border-dathua-border rounded-lg px-3.5 py-2.5">
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="isRootGateway" type="checkbox" class="w-4 h-4 rounded accent-dathua-orange" />
            <span class="text-xs text-gray-300">Es el gateway principal</span>
          </label>
          <!-- SNMP: existe en el modelo de datos pero aún no es configurable desde aquí, en ningún modo -->
          <span class="text-[10px] uppercase tracking-wide bg-white/5 border border-white/10 rounded-full px-2 py-0.5 text-dathua-text-soft shrink-0" title="Monitoreo avanzado por SNMP (CPU, memoria, tráfico) — próximamente">
            SNMP: próximamente
          </span>
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
            :disabled="submitting || !isFormValid"
            class="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-dathua-orange text-white hover:bg-[#B45309] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {{ submitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : isApproving ? 'Aprobar y monitorear' : 'Crear equipo' }}
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
import { formatDeviceType } from '../../../utils/metrics'
import { ipError, macError } from '../../../utils/validators'
import { DEVICE_ICONS, DEVICE_TYPES } from '../../../utils/deviceIcons'
import TextField from '../../form/TextField.vue'

const deviceTypes = DEVICE_TYPES

const props = defineProps({
  site: { type: Object, required: true },
  zones: { type: Array, default: () => [] },
  nodes: { type: Array, default: () => [] },
  node: { type: Object, default: null },
  // Zona a preseleccionar al crear un equipo nuevo (ej. cuando se llega
  // desde "+ Agregar equipo" filtrando ya una zona en Métricas/Nodos) —
  // se ignora si `node` viene definido (edición usa la zona del equipo).
  defaultZoneId: { type: [Number, String], default: '' },
  // Candidato de descubrimiento a aprobar — mismo panel que crear un
  // equipo nuevo, pero precargado con lo que ya detectó el agente (IP/MAC
  // fijas, no editables aquí) y enviando al endpoint de aprobar en vez de
  // crear. Se ignora si `node` viene definido.
  candidate: { type: Object, default: null },
})
const emit = defineEmits(['close', 'created', 'saved'])

const auth = useAuthStore()
const dashboard = useDashboardStore()

const isEdit = computed(() => Boolean(props.node))
const isApproving = computed(() => !props.node && Boolean(props.candidate))

const name = ref(props.node?.name || props.candidate?.hostname || props.candidate?.ipAddress || '')
const deviceType = ref(props.node?.deviceType || props.candidate?.suggestedDeviceType || 'router')
const ipAddress = ref(props.node?.ipAddress || props.candidate?.ipAddress || '')
const macAddress = ref(props.node?.macAddress || props.candidate?.macAddress || '')
const zoneId = ref(props.node?.zoneId ?? props.defaultZoneId ?? '')
const parentNodeId = ref(props.node?.parentNodeId ?? '')
const isRootGateway = ref(Boolean(props.node?.isRootGateway))
const error = ref('')
const submitting = ref(false)
const ipTouched = ref(false)
const macTouched = ref(false)

const ipErrorMsg = computed(() => ipError(ipAddress.value))
const macErrorMsg = computed(() => macError(macAddress.value))
const isFormValid = computed(() => Boolean(name.value.trim()) && !ipErrorMsg.value && !macErrorMsg.value)

// Evita ofrecer como padre al propio nodo o a cualquiera de sus
// descendientes — formaría un ciclo que el backend rechazaría de todos
// modos, pero es más claro no dejarlo elegir en primer lugar.
const availableParents = computed(() => {
  if (!isEdit.value) return props.nodes
  const blocked = new Set([props.node.nodeId])
  let added = true
  while (added) {
    added = false
    for (const n of props.nodes) {
      if (n.parentNodeId && blocked.has(n.parentNodeId) && !blocked.has(n.nodeId)) {
        blocked.add(n.nodeId)
        added = true
      }
    }
  }
  return props.nodes.filter((n) => !blocked.has(n.nodeId))
})

async function submit() {
  ipTouched.value = true
  macTouched.value = true
  if (!isFormValid.value) return
  submitting.value = true
  error.value = ''
  const payload = {
    name: name.value.trim(),
    deviceType: deviceType.value,
    ipAddress: ipAddress.value.trim(),
    macAddress: macAddress.value.trim() || null,
    zoneId: zoneId.value || null,
    parentNodeId: parentNodeId.value || null,
    isRootGateway: isRootGateway.value,
  }
  try {
    if (isEdit.value) {
      await dashboard.editNode(auth.token, props.node.nodeId, props.site.siteId, payload)
      emit('saved')
    } else if (isApproving.value) {
      // La IP/MAC ya quedan fijas en la fila del candidato desde que el
      // agente las detectó — todo lo demás (zona, de qué depende, si es
      // el gateway) se manda igual que al crear un equipo libre.
      await dashboard.approveCandidate(auth.token, props.candidate.candidateId, props.site.siteId, {
        name: payload.name,
        deviceType: payload.deviceType,
        zoneId: payload.zoneId,
        parentNodeId: payload.parentNodeId,
        isRootGateway: payload.isRootGateway,
      })
      emit('created')
    } else {
      await dashboard.addNode(auth.token, { ...payload, siteId: props.site.siteId })
      emit('created')
    }
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}
</script>
