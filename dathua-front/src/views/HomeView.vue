<template>
  <div class="relative bg-dathua-bg min-h-screen">
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
      <TheFooter />
    </div>
  </div>
</template>

<script setup>
import TheNavbar from '../components/TheNavbar.vue'
import TheHero from '../components/TheHero.vue'
import TheProblema from '../components/TheProblema.vue'
import TheSolucion from '../components/TheSolucion.vue'
import TheStats from '../components/TheStats.vue'
import TheModelo from '../components/TheModelo.vue'
import TheEquipo from '../components/TheEquipo.vue'
import TheFooter from '../components/TheFooter.vue'
</script>
