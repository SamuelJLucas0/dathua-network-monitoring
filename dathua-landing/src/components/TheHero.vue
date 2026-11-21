<template>
  <section class="relative min-h-screen flex items-center pt-20 overflow-hidden" @mousemove="handleMouse">
    <svg class="absolute inset-0 w-full h-full opacity-40 transition-transform duration-300 ease-out" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" :style="{ transform: `translate(${offsetX}px, ${offsetY}px)` }">
      <line x1="120" y1="120" x2="320" y2="220" stroke="#2B3540" stroke-width="1.5"/>
      <line x1="320" y1="220" x2="560" y2="140" stroke="#2B3540" stroke-width="1.5"/>
      <line x1="320" y1="220" x2="300" y2="420" stroke="#2B3540" stroke-width="1.5"/>
      <line x1="560" y1="140" x2="680" y2="300" stroke="#2B3540" stroke-width="1.5"/>
      <line x1="300" y1="420" x2="520" y2="460" stroke="#2B3540" stroke-width="1.5"/>
      <line x1="520" y1="460" x2="680" y2="300" stroke="#2B3540" stroke-width="1.5"/>

      <circle cx="120" cy="120" r="6" fill="#D96B14" class="animate-pulse-node"/>
      <circle cx="320" cy="220" r="6" fill="#D96B14" class="animate-pulse-node" style="animation-delay:0.4s"/>
      <circle cx="560" cy="140" r="6" fill="#D96B14" class="animate-pulse-node" style="animation-delay:0.8s"/>
      <circle cx="680" cy="300" r="6" fill="#D96B14" class="animate-pulse-node" style="animation-delay:1.2s"/>
      <circle cx="300" cy="420" r="6" fill="#D96B14" class="animate-pulse-node" style="animation-delay:0.2s"/>
      <circle cx="520" cy="460" r="6" fill="#D96B14" class="animate-pulse-node" style="animation-delay:1.6s"/>
    </svg>

    <div class="relative max-w-6xl mx-auto px-6 py-20 text-center">
      <span v-reveal class="inline-block bg-dathua-orange/10 text-dathua-orange text-xs font-medium px-3 py-1 rounded-full mb-6">
        Observabilidad de red con Inteligencia Artificial
      </span>
      <h1 v-reveal="{ delay: 100 }" class="font-heading text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
        Monitorea tu red antes<br class="hidden md:block" /> de que falle
      </h1>
      <p v-reveal="{ delay: 200 }" class="text-dathua-text-soft text-lg max-w-2xl mx-auto mb-10">
        DatHua vigila el comportamiento de tu red las 24 horas y te avisa en cuanto algo empieza a
        salirse de lo normal — mucho antes de que se convierta en una caída total. Pensado para
        negocios que dependen de su conexión, sin necesitar a nadie experto en redes.
      </p>
      <div v-reveal="{ delay: 300 }" class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="#solucion" class="bg-dathua-orange hover:bg-dathua-orange-hover text-white font-medium px-8 py-3 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95">
          Conoce la solución
        </a>
        <a href="#modelo" class="border border-dathua-border text-white font-medium px-8 py-3 rounded-lg hover:bg-dathua-card transition-all duration-200 hover:scale-105 active:scale-95">
          Ver planes
        </a>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'

const offsetX = ref(0)
const offsetY = ref(0)

function handleMouse(e) {
  const { innerWidth, innerHeight } = window
  offsetX.value = ((e.clientX / innerWidth) - 0.5) * 20
  offsetY.value = ((e.clientY / innerHeight) - 0.5) * 20
}
</script>