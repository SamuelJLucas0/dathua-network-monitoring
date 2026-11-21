<template>
  <div>
    <div class="flex items-center justify-between text-xs mb-1.5">
      <span class="text-dathua-text-soft">{{ label }}</span>
      <span class="text-white font-medium">{{ used }} / {{ limit }}</span>
    </div>
    <div class="h-2 rounded-full bg-dathua-border/60 overflow-hidden">
      <div class="h-full rounded-full transition-all duration-500" :style="{ width: pct + '%', backgroundColor: color }"></div>
    </div>
    <p v-if="hint" class="text-xs text-dathua-text-soft/80 mt-1.5">{{ hint }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ROLE_COLOR } from '../../utils/status'

const props = defineProps({
  label: { type: String, required: true },
  used: { type: Number, required: true },
  limit: { type: Number, required: true },
  tone: { type: String, default: 'brand' }, // brand | good | warning | serious | critical
  hint: { type: String, default: '' },
})

const pct = computed(() => (props.limit > 0 ? Math.min(100, (props.used / props.limit) * 100) : 0))
const color = computed(() => (props.tone === 'brand' ? 'var(--color-dathua-orange)' : ROLE_COLOR[props.tone]))
</script>
