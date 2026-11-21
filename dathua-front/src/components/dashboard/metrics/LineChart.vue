<template>
  <div class="w-full">
    <div
      v-if="hasData"
      ref="areaRef"
      class="relative w-full"
      :style="{ height: height + 'px' }"
      @mousemove="onMove"
      @mouseleave="onLeave"
      @touchstart="onTouchMove"
      @touchmove="onTouchMove"
      @touchend="onLeave"
    >
      <svg :viewBox="`0 0 ${width} ${height}`" preserveAspectRatio="none" class="w-full h-full overflow-visible">
        <polygon v-for="(seg, i) in segments" :key="'fill' + i" :points="fillPoints(seg)" :fill="color" fill-opacity="0.1" stroke="none" />
        <polyline
          v-for="(seg, i) in segments"
          :key="'line' + i"
          :points="linePoints(seg)"
          fill="none"
          :stroke="color"
          stroke-width="1.75"
          stroke-linejoin="round"
          stroke-linecap="round"
          vector-effect="non-scaling-stroke"
        />
        <line
          v-if="hoverIndex !== null"
          :x1="hoverX" :x2="hoverX" y1="0" :y2="height"
          stroke="white" stroke-opacity="0.15" stroke-width="1"
          vector-effect="non-scaling-stroke"
        />
        <circle
          v-if="hoverPoint"
          :cx="hoverPoint.x" :cy="hoverPoint.y" r="3"
          :fill="color" stroke="#161B22" stroke-width="1.5"
        />
        <g v-else-if="hoverIndex === null && lastPoint">
          <circle :cx="lastPoint.x" :cy="lastPoint.y" r="2.5" :fill="color" class="chart-live-pulse" />
          <circle :cx="lastPoint.x" :cy="lastPoint.y" r="2.5" :fill="color" />
        </g>

        <!-- Marcador de incidente/anomalía — llega por deep-link desde
             Incidentes/IA Sentinel (ver NodeDetailView.vue) para ubicar
             visualmente "aquí fue" en la gráfica, no solo en texto. -->
        <g v-for="(mk, i) in markerPoints" :key="'marker' + i">
          <line :x1="mk.x" :x2="mk.x" y1="0" :y2="height" :stroke="mk.color" stroke-width="1.5" stroke-dasharray="3,3" vector-effect="non-scaling-stroke" />
          <circle :cx="mk.x" :cy="mk.y" r="4" :fill="mk.color" stroke="#161B22" stroke-width="1.5" />
        </g>
      </svg>

      <div
        v-for="(mk, i) in markerPoints"
        :key="'markerlabel' + i"
        class="absolute z-10 px-1.5 py-0.5 rounded text-[9px] font-semibold text-white shadow-lg pointer-events-none whitespace-nowrap max-w-[140px] truncate"
        :style="{
          left: `${Math.min(94, Math.max(4, (mk.x / width) * 100))}%`,
          top: `${mk.y}px`,
          transform: mk.labelBelow ? 'translate(-50%, 6px)' : 'translate(-50%, calc(-100% - 6px))',
          backgroundColor: mk.color,
        }"
      >
        {{ mk.label }}
      </div>

      <template v-if="showAxis">
        <span class="absolute left-0 top-0 text-[10px] text-dathua-text-soft/60 leading-none pointer-events-none">{{ formatValue(max) }}{{ unit }}</span>
        <span class="absolute left-0 bottom-0 text-[10px] text-dathua-text-soft/60 leading-none pointer-events-none">{{ formatValue(min) }}{{ unit }}</span>
      </template>

      <div
        v-if="hoverIndex !== null"
        class="absolute z-10 px-2 py-1 rounded-md bg-dathua-bg border border-dathua-border text-[10px] leading-tight text-white shadow-lg pointer-events-none whitespace-nowrap"
        :style="tooltipStyle"
      >
        <div class="text-dathua-text-soft">{{ hoverTimeLabel }}</div>
        <div class="font-semibold">{{ hoverValueLabel }}</div>
      </div>
    </div>
    <div v-else class="w-full flex items-center justify-center text-[11px] text-dathua-text-soft/60" :style="{ height: height + 'px' }">
      Sin datos en esta ventana
    </div>

    <div v-if="showAxis && hasData" class="flex items-center justify-between mt-1 text-[10px] text-dathua-text-soft/70">
      <span>{{ firstTimeLabel }}</span>
      <span>{{ lastTimeLabel }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  series: { type: Array, default: () => [] }, // [{ t, value }]
  color: { type: String, default: '#D96B14' },
  height: { type: Number, default: 56 },
  unit: { type: String, default: '' }, // se anexa al valor en tooltip/eje, ej. " ms"
  showAxis: { type: Boolean, default: true }, // false para sparklines muy pequeños (sin espacio para ejes)
  // Puntos a marcar sobre la línea: [{ t, label, color }]. Pensado para un
  // único incidente/anomalía llegado por deep-link (ver NodeDetailView.vue),
  // pero admite varios.
  markers: { type: Array, default: () => [] },
})

const width = 300
const areaRef = ref(null)
const hoverIndex = ref(null)

const values = computed(() => props.series.map((p) => p.value).filter((v) => v !== null && v !== undefined))
const hasData = computed(() => values.value.length > 0)
const min = computed(() => Math.min(...values.value))
const max = computed(() => Math.max(...values.value))
const range = computed(() => max.value - min.value || 1)

function scaleX(i) {
  return (i / Math.max(props.series.length - 1, 1)) * width
}

function scaleY(v) {
  const pad = 4
  return props.height - pad - ((v - min.value) / range.value) * (props.height - pad * 2)
}

// Corta la línea en segmentos consecutivos válidos — un hueco sin
// telemetría se ve como un hueco real en la gráfica, no como una línea
// que salta por encima del vacío.
const segments = computed(() => {
  const segs = []
  let current = []
  props.series.forEach((p, i) => {
    if (p.value === null || p.value === undefined) {
      if (current.length) segs.push(current)
      current = []
    } else {
      current.push({ x: scaleX(i), y: scaleY(p.value) })
    }
  })
  if (current.length) segs.push(current)
  return segs
})

function linePoints(seg) {
  return seg.map((p) => `${p.x},${p.y}`).join(' ')
}

function fillPoints(seg) {
  if (seg.length < 2) return ''
  const bottom = props.height
  return `${seg[0].x},${bottom} ` + seg.map((p) => `${p.x},${p.y}`).join(' ') + ` ${seg[seg.length - 1].x},${bottom}`
}

const lastPoint = computed(() => {
  const last = segments.value[segments.value.length - 1]
  return last ? last[last.length - 1] : null
})

// Ubica cada marcador en el punto de la serie más cercano a su hora real.
// Si el punto más cercano queda demasiado lejos (el incidente ocurrió fuera
// de la ventana visible — 15min/1h/24h — o no hay suficientes puntos), no
// se dibuja: es preferible no mostrar nada a clavar el pico en el borde
// equivocado de la gráfica y que parezca que pasó ahí.
const markerPoints = computed(() => {
  if (!props.markers.length || props.series.length < 2) return []
  const times = props.series.map((p) => new Date(p.t).getTime())
  const avgGap = (times[times.length - 1] - times[0]) / (times.length - 1) || Infinity
  const tolerance = avgGap * 1.5

  return props.markers
    .map((mk) => {
      const target = new Date(mk.t).getTime()
      if (Number.isNaN(target)) return null
      let bestIdx = 0
      let bestDiff = Infinity
      times.forEach((t, i) => {
        const diff = Math.abs(t - target)
        if (diff < bestDiff) {
          bestDiff = diff
          bestIdx = i
        }
      })
      if (bestDiff > tolerance) return null
      const p = props.series[bestIdx]
      const y = p.value === null || p.value === undefined ? props.height / 2 : scaleY(p.value)
      // Si el pico está muy cerca del borde superior (o es el valor más
      // alto de la ventana), la etiqueta no cabe arriba sin encimarse con
      // el título de la gráfica — se dibuja debajo del punto en ese caso.
      return { x: scaleX(bestIdx), y, label: mk.label || 'Evento', color: mk.color || '#EF4444', labelBelow: y < 14 }
    })
    .filter(Boolean)
})

function formatValue(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

const firstTimeLabel = computed(() => (props.series[0] ? formatTime(props.series[0].t) : ''))
const lastTimeLabel = computed(() => 'ahora')

// Interactividad: mover el mouse (o el dedo) sobre la gráfica muestra la
// hora y el valor exactos del punto más cercano — sin esto una gráfica de
// tendencia solo comunica "sube/baja", no cuánto ni cuándo.
function indexFromClientX(clientX) {
  if (!areaRef.value) return null
  const rect = areaRef.value.getBoundingClientRect()
  if (rect.width === 0) return null
  const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  return Math.round(fraction * (props.series.length - 1))
}

function onMove(e) {
  const idx = indexFromClientX(e.clientX)
  if (idx !== null) hoverIndex.value = idx
}

function onTouchMove(e) {
  const touch = e.touches[0]
  if (!touch) return
  const idx = indexFromClientX(touch.clientX)
  if (idx !== null) hoverIndex.value = idx
}

function onLeave() {
  hoverIndex.value = null
}

const hoverPoint = computed(() => {
  if (hoverIndex.value === null) return null
  const p = props.series[hoverIndex.value]
  if (!p || p.value === null || p.value === undefined) return null
  return { x: scaleX(hoverIndex.value), y: scaleY(p.value) }
})

const hoverX = computed(() => (hoverIndex.value === null ? 0 : scaleX(hoverIndex.value)))

const hoverTimeLabel = computed(() => {
  if (hoverIndex.value === null) return ''
  const p = props.series[hoverIndex.value]
  return p ? formatTime(p.t) : ''
})

const hoverValueLabel = computed(() => {
  if (hoverIndex.value === null) return ''
  const p = props.series[hoverIndex.value]
  if (!p || p.value === null || p.value === undefined) return 'Sin dato'
  return `${formatValue(p.value)}${props.unit}`
})

const tooltipStyle = computed(() => {
  const leftPct = Math.min(96, Math.max(4, (hoverX.value / width) * 100))
  const topPx = hoverPoint.value ? hoverPoint.value.y : props.height / 2
  return {
    left: `${leftPct}%`,
    top: `${topPx}px`,
    transform: 'translate(-50%, calc(-100% - 8px))',
  }
})
</script>

<style scoped>
/* Anillo que "respira" sobre el último punto — sin esto una gráfica que
   ya llegó a "ahora" se siente estática, como una foto en vez de un dato
   que sigue vivo. */
.chart-live-pulse {
  transform-box: fill-box;
  transform-origin: center;
  animation: chart-live-pulse 2.2s ease-out infinite;
}

@keyframes chart-live-pulse {
  0% {
    transform: scale(1);
    opacity: 0.55;
  }
  100% {
    transform: scale(4.5);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .chart-live-pulse {
    animation: none;
    opacity: 0;
  }
}
</style>
