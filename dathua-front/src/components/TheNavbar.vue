<template>
  <nav
    class="fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out"
    :class="scrolled
      ? 'bg-dathua-bg/90 backdrop-blur-xl border-b border-dathua-border/80 shadow-[0_10px_40px_rgba(0,0,0,0.25)] py-3'
      : 'bg-transparent py-5'"
  >
    <div class="max-w-6xl mx-auto px-6 flex items-center justify-between gap-4">
      <!-- Logo -->
      <a href="#inicio" class="shrink-0 group">
        <img src="/logo.png" alt="DatHua" class="h-13 md:h-15 w-auto transition-transform duration-300 group-hover:scale-105" />
      </a>

      <!-- Navegación desktop -->
      <div class="hidden md:flex items-center gap-8 text-sm text-dathua-text-soft">
        <a
          v-for="link in links"
          :key="link.href"
          :href="link.href"
          class="group relative py-2 transition-colors duration-300 hover:text-white"
        >
          {{ link.label }}
          <span class="absolute left-1/2 -bottom-0.5 h-[2px] w-0 -translate-x-1/2 rounded-full bg-dathua-orange transition-all duration-300 ease-out group-hover:w-full"></span>
        </a>
      </div>

      <!-- Acciones desktop -->
      <div class="hidden md:flex items-center gap-3 shrink-0">
        <router-link to="/login" class="text-sm font-medium text-dathua-text-soft hover:text-white transition-colors duration-300 px-3 py-2">
          Iniciar sesión
        </router-link>
        <router-link to="/register" class="text-sm font-medium text-white bg-dathua-orange hover:bg-dathua-orange-hover px-5 py-2.5 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95">
          Regístrate
        </router-link>
      </div>

      <!-- Botón menú mobile -->
      <button
        @click="menuOpen = !menuOpen"
        type="button"
        aria-label="Abrir menú"
        :aria-expanded="menuOpen"
        class="md:hidden w-10 h-10 rounded-xl flex items-center justify-center text-dathua-text-soft border border-dathua-border/70 bg-dathua-card/50 transition-all duration-300 hover:text-white hover:border-dathua-orange/50 hover:bg-dathua-orange/10 active:scale-95"
      >
        <svg v-if="!menuOpen" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Menú mobile -->
    <transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 -translate-y-3"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-3"
    >
      <div v-if="menuOpen" class="md:hidden mt-3 mx-4 rounded-2xl bg-dathua-bg/95 backdrop-blur-xl border border-dathua-border shadow-[0_20px_50px_rgba(0,0,0,0.35)] overflow-hidden">
        <div class="p-3">
          <a
            v-for="link in links"
            :key="link.href"
            :href="link.href"
            @click="menuOpen = false"
            class="group flex items-center justify-between px-4 py-3.5 rounded-xl text-sm text-dathua-text-soft transition-all duration-300 hover:text-white hover:bg-dathua-orange/10"
          >
            <span>{{ link.label }}</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 opacity-0 -translate-x-2 text-dathua-orange transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>

          <div class="mt-2 pt-3 border-t border-dathua-border/60 flex flex-col gap-2 px-1">
            <router-link to="/login" class="text-center text-sm font-medium text-dathua-text-soft hover:text-white transition-colors duration-300 px-4 py-3 rounded-xl hover:bg-dathua-orange/10">
              Iniciar sesión
            </router-link>
            <router-link to="/register" class="text-center text-sm font-medium text-white bg-dathua-orange hover:bg-dathua-orange-hover px-4 py-3 rounded-xl transition-colors duration-300">
              Regístrate
            </router-link>
          </div>
        </div>
      </div>
    </transition>
  </nav>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const scrolled = ref(false)
const menuOpen = ref(false)

const links = [
  { href: '#problema', label: 'Problema' },
  { href: '#solucion', label: 'Solución' },
  { href: '#modelo', label: 'Planes' },
  { href: '#equipo', label: 'Equipo' },
]

function handleScroll() {
  scrolled.value = window.scrollY > 20
}

onMounted(() => window.addEventListener('scroll', handleScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', handleScroll))
</script>
