<template>
  <div class="relative bg-dathua-bg min-h-screen">
    <div class="fixed top-0 left-0 right-0 h-1 z-[60] bg-dathua-border/40">
      <div class="h-full bg-dathua-orange transition-[width] duration-150" :style="{ width: scrollProgress + '%' }"></div>
    </div>

    <div class="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <div class="absolute top-[8%] -left-40 w-96 h-96 bg-dathua-orange/10 rounded-full blur-3xl animate-glow"></div>
      <div class="absolute top-[42%] -right-40 w-[28rem] h-[28rem] bg-dathua-orange/5 rounded-full blur-3xl animate-glow" style="animation-delay: 2.5s"></div>
      <div class="absolute bottom-[6%] left-[18%] w-80 h-80 bg-dathua-orange/5 rounded-full blur-3xl animate-glow" style="animation-delay: 5s"></div>
    </div>

    <div class="relative z-10">
      <TheNavbar />
      <TheHero />
      <TheProblema />
      <TheSolucion />
      <TheStats />
      <TheModelo />
      <TheEquipo />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import TheNavbar from './components/TheNavbar.vue'
import TheHero from './components/TheHero.vue'
import TheProblema from './components/TheProblema.vue'
import TheSolucion from './components/TheSolucion.vue'
import TheStats from './components/TheStats.vue'
import TheModelo from './components/TheModelo.vue'
import TheEquipo from './components/TheEquipo.vue'

const scrollProgress = ref(0)

function handleScroll() {
  const h = document.documentElement
  const scrollable = h.scrollHeight - h.clientHeight
  scrollProgress.value = scrollable > 0 ? (h.scrollTop / scrollable) * 100 : 0
}

onMounted(() => window.addEventListener('scroll', handleScroll))
onUnmounted(() => window.removeEventListener('scroll', handleScroll))
</script>