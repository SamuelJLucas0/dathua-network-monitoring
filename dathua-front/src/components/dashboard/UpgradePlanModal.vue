<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto [align-items:safe_center]" @click.self="$emit('close')">
    <div class="w-full max-w-lg bg-dathua-card border border-dathua-border rounded-2xl p-6 shadow-2xl my-8">
      <h2 class="font-heading text-lg font-bold text-white mb-1">Mejora tu plan</h2>
      <p class="text-dathua-text-soft text-xs mb-5">
        Ya llegaste al límite de sucursales de tu plan {{ current.label }}. Con {{ target.label }} puedes seguir creciendo.
      </p>

      <div class="grid grid-cols-2 gap-3 mb-5">
        <div class="border border-dathua-border rounded-xl p-4">
          <p class="text-xs text-dathua-text-soft mb-1">Tu plan actual</p>
          <p class="text-white font-semibold mb-3">{{ current.label }}</p>
          <ul class="space-y-1.5 text-xs text-dathua-text-soft">
            <li>{{ current.maxSites }} sucursal{{ current.maxSites > 1 ? 'es' : '' }}</li>
            <li>Hasta {{ current.maxNodesPerSite }} nodos/sucursal</li>
            <li>${{ current.priceMXN }} MXN/mes</li>
          </ul>
        </div>

        <div class="border border-dathua-orange/50 bg-dathua-orange/5 rounded-xl p-4 relative">
          <span class="absolute -top-2.5 right-3 text-[10px] uppercase tracking-wide bg-dathua-orange text-white rounded-full px-2 py-0.5">Recomendado</span>
          <p class="text-xs text-dathua-orange mb-1">Actualiza a</p>
          <p class="text-white font-semibold mb-3">{{ target.label }}</p>
          <ul class="space-y-1.5 text-xs text-gray-300">
            <li>{{ target.maxSites }} sucursales</li>
            <li>Hasta {{ target.maxNodesPerSite }} nodos/sucursal</li>
            <li>${{ target.priceMXN }} MXN/mes</li>
          </ul>
        </div>
      </div>

      <div class="flex items-center justify-between gap-2 text-dathua-text-soft border border-dathua-border rounded-lg px-3.5 py-2.5 mb-5">
        <span class="text-xs">Aquí conectaremos el cobro recurrente</span>
        <span class="text-[10px] uppercase tracking-wide bg-white/5 border border-white/10 rounded-full px-2 py-0.5 shrink-0">Próximamente</span>
      </div>

      <div class="flex items-center gap-3">
        <button type="button" class="flex-1 py-2.5 rounded-lg text-sm font-semibold text-dathua-text-soft border border-dathua-border hover:text-white hover:border-white/30 transition-colors duration-200 cursor-pointer" @click="$emit('close')">
          Cerrar
        </button>
        <button
          type="button"
          disabled
          title="El cobro recurrente todavía no está integrado"
          class="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-dathua-orange text-white opacity-50 cursor-not-allowed"
        >
          Actualizar a {{ target.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useDashboardStore } from '../../stores/dashboard'
import { PLANS, otherPlan } from '../../utils/plans'

defineEmits(['close'])

const dashboard = useDashboardStore()

const current = computed(() => PLANS[dashboard.usage?.plan] || PLANS.BASICO)
const target = computed(() => otherPlan(dashboard.usage?.plan))
</script>
