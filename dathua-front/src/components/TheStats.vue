<template>
  <section class="py-16 px-4 sm:px-6 border-y border-dathua-border">
    <div ref="statsRef" class="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10 sm:gap-x-8 md:gap-8 text-center">
      <div v-for="stat in stats" :key="stat.label" class="min-w-0">
        <div class="font-heading text-3xl sm:text-4xl font-bold text-dathua-orange mb-1 whitespace-nowrap">
          {{ stat.prefix }}{{ displayValues[stat.label] }}{{ stat.suffix }}
        </div>
        <div class="text-dathua-text-soft text-sm leading-snug max-w-[140px] mx-auto">
          {{ stat.label }}
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

const stats = [
  { label: 'Más económico', target: 70, suffix: '%', prefix: '' },
  { label: 'Sucursales por cliente', target: 3, suffix: '', prefix: 'Hasta ' },
  { label: 'Monitoreo activo', target: 24, suffix: '/7', prefix: '' },
  { label: 'Días de prueba gratis', target: 30, suffix: '', prefix: 'Hasta ' },
]

const displayValues = reactive({})
stats.forEach((s) => (displayValues[s.label] = 0))

const statsRef = ref(null)
let animated = false

function animateCount() {
  if (animated) return
  animated = true

  stats.forEach((stat) => {
    const duration = 1200
    const start = performance.now()

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1)
      displayValues[stat.label] = Math.floor(progress * stat.target)

      if (progress < 1) requestAnimationFrame(tick)
      else displayValues[stat.label] = stat.target
    }

    requestAnimationFrame(tick)
  })
}

onMounted(() => {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        animateCount()
        observer.disconnect()
      }
    },
    { threshold: 0.3 },
  )
  observer.observe(statsRef.value)
})
</script>
