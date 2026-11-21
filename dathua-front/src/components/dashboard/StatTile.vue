<template>
  <div class="bg-dathua-card border border-dathua-border rounded-2xl p-5 flex items-start gap-4">
    <div
      class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
      :style="{ color: toneColor, backgroundColor: toneBg }"
    >
      <slot name="icon" />
    </div>
    <div class="min-w-0">
      <p class="text-xs text-dathua-text-soft mb-1">{{ label }}</p>
      <p class="text-2xl font-heading font-bold text-white leading-none [font-variant-numeric:proportional-nums]">
        {{ value }}
      </p>
      <p v-if="hint" class="text-xs text-dathua-text-soft mt-1.5">{{ hint }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ROLE_COLOR } from '../../utils/status'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  hint: { type: String, default: '' },
  tone: { type: String, default: 'brand' }, // brand | good | warning | serious | critical | neutral
})

const toneColor = computed(() =>
  props.tone === 'brand' ? 'var(--color-dathua-orange)' : ROLE_COLOR[props.tone],
)
const toneBg = computed(() => `color-mix(in oklab, ${toneColor.value} 15%, transparent)`)
</script>
