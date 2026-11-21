<template>
  <div>
    <div v-if="total > 0" class="flex items-center gap-0.5 h-2.5" role="img" :aria-label="ariaLabel">
      <div
        v-for="seg in segments"
        :key="seg.key"
        class="h-full rounded-full transition-[flex-grow] duration-500"
        :style="{ flex: `${seg.count} 0 0%`, backgroundColor: seg.color }"
        :title="`${seg.label}: ${seg.count}`"
      ></div>
    </div>
    <div v-else class="h-2.5 rounded-full bg-dathua-border/40"></div>
    <p v-if="total === 0" class="text-xs text-dathua-text-soft mt-2">Todavía no tienes equipos aquí.</p>

    <div v-if="total > 0" class="mt-4 flex flex-wrap gap-x-5 gap-y-2">
      <div v-for="s in legend" :key="s.key" class="flex items-center gap-1.5 text-xs">
        <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: s.color }"></span>
        <span class="text-dathua-text-soft">{{ s.label }}</span>
        <span class="text-white font-semibold">{{ s.count }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { NODE_STATUS, ROLE_COLOR } from '../../utils/status'

const STATUS_ORDER = ['Online', 'Warning', 'Offline', 'Critical', 'Unknown']

const props = defineProps({
  counts: { type: Object, required: true },
})

const total = computed(() => Object.values(props.counts).reduce((sum, n) => sum + n, 0))

const legend = computed(() =>
  STATUS_ORDER.map((key) => ({
    key,
    label: NODE_STATUS[key].label,
    color: ROLE_COLOR[NODE_STATUS[key].role],
    count: props.counts[key] || 0,
  })),
)

const segments = computed(() => legend.value.filter((s) => s.count > 0))

const ariaLabel = computed(() =>
  legend.value.map((s) => `${s.label}: ${s.count}`).join(', '),
)
</script>
