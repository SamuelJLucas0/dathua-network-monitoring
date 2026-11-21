<template>
  <span class="inline-flex items-center gap-1.5 text-xs font-medium text-gray-300 bg-white/5 border border-white/10 rounded-full px-2.5 py-1">
    <span class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ backgroundColor: color }"></span>
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { SEVERITY, ROLE_COLOR } from '../../utils/status'

const props = defineProps({
  severity: { type: String, required: true },
})

const entry = computed(() => SEVERITY[props.severity?.toUpperCase()] || SEVERITY.UNKNOWN)
const label = computed(() => entry.value.label)
const color = computed(() => ROLE_COLOR[entry.value.role])
</script>
