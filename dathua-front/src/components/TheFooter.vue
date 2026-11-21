<template>
  <footer class="relative border-t border-dathua-border px-6 pt-16 pb-8 overflow-hidden">
    <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-64 bg-dathua-orange/5 blur-[130px] rounded-full pointer-events-none -z-10"></div>

    <div class="max-w-6xl mx-auto">
      <div class="grid grid-cols-2 md:grid-cols-5 gap-10 md:gap-8">
        <!-- Marca -->
        <div class="col-span-2">
          <img src="/logo.png" alt="DatHua" class="h-12 w-auto mb-4" />
          <p class="text-dathua-text-soft text-sm leading-relaxed max-w-xs">
            Observabilidad de red con inteligencia artificial para PyMEs mexicanas con hasta 3
            sucursales. Monitorea tu conectividad antes de que se convierta en un problema.
          </p>
          <a
            href="mailto:dathuaapp@gmail.com"
            class="inline-flex items-center gap-2 mt-5 text-sm text-dathua-text-soft hover:text-dathua-orange transition-colors duration-300"
          >
            <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            dathuaapp@gmail.com
          </a>
        </div>

        <!-- Producto -->
        <div>
          <h4 class="text-white text-sm font-semibold mb-4">Producto</h4>
          <ul class="space-y-3 text-sm text-dathua-text-soft">
            <li><a href="#problema" class="hover:text-dathua-orange transition-colors duration-300">El problema</a></li>
            <li><a href="#solucion" class="hover:text-dathua-orange transition-colors duration-300">La solución</a></li>
            <li><a href="#modelo" class="hover:text-dathua-orange transition-colors duration-300">Planes y precios</a></li>
            <li><a href="#equipo" class="hover:text-dathua-orange transition-colors duration-300">Equipo</a></li>
          </ul>
        </div>

        <!-- Empresa -->
        <div>
          <h4 class="text-white text-sm font-semibold mb-4">Empresa</h4>
          <ul class="space-y-3 text-sm text-dathua-text-soft">
            <li><a href="/terminos" class="hover:text-dathua-orange transition-colors duration-300">Términos y condiciones</a></li>
            <li><a href="/privacidad" class="hover:text-dathua-orange transition-colors duration-300">Aviso de privacidad</a></li>
            <li><router-link to="/register" class="hover:text-dathua-orange transition-colors duration-300">Crear cuenta</router-link></li>
            <li><router-link to="/login" class="hover:text-dathua-orange transition-colors duration-300">Iniciar sesión</router-link></li>
          </ul>
        </div>

        <!-- Tecnología -->
        <div>
          <h4 class="text-white text-sm font-semibold mb-4">Tecnología</h4>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="tech in stack"
              :key="tech"
              class="text-xs text-dathua-text-soft border border-dathua-border rounded-full px-3 py-1"
            >
              {{ tech }}
            </span>
          </div>
        </div>
      </div>

      <div class="mt-14 pt-6 border-t border-dathua-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-dathua-text-soft/70">
        <p>&copy; {{ year }} DatHua. Todos los derechos reservados.</p>
        <p>Hecho en México, para negocios mexicanos.</p>
      </div>
    </div>
  </footer>
</template>

<script setup>
const year = new Date().getFullYear()

const stack = [
  'Vue 3',
  'Node.js / Express',
  'Python / Flask',
  'MySQL',
  'MongoDB Atlas',
  'Socket.IO',
]
</script>
