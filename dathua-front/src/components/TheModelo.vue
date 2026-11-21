<template>
  <section id="modelo" class="scroll-mt-24 py-24 px-6 relative overflow-hidden">
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-dathua-orange/10 blur-[150px] rounded-full pointer-events-none -z-10"></div>

    <div class="max-w-5xl mx-auto">
      <div v-reveal class="text-center mb-16">
        <span class="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest text-dathua-orange bg-dathua-orange/10 border border-dathua-orange/30 mb-4">
          Modelo de negocio
        </span>
        <h2 class="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
          Planes flexibles según tu infraestructura
        </h2>
        <p class="text-gray-400 text-sm md:text-base mt-3 max-w-xl mx-auto">
          Monitoreo inteligente y detección de anomalías adaptado a las necesidades de tu red.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10 items-stretch max-w-4xl mx-auto">
        <!-- Plan Básico -->
        <div v-reveal="{ delay: 100 }" class="group relative flex flex-col justify-between bg-dathua-card/80 backdrop-blur-sm border border-white/10 rounded-3xl p-8 overflow-hidden transition-all duration-500 ease-out hover:-translate-y-3 hover:scale-[1.02] hover:border-dathua-orange/60 hover:shadow-[0_25px_60px_rgba(217,107,20,0.15)]">
          <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(217,107,20,0.12),transparent_55%)]"></div>
          <div class="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-dathua-orange to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>

          <div class="relative z-10">
            <div class="flex items-start justify-between gap-4 mb-6">
              <div>
                <span class="text-gray-400 text-xs font-semibold uppercase tracking-wider block mb-1">Plan inicial</span>
                <h3 class="text-2xl font-bold text-white tracking-tight transition-colors duration-300 group-hover:text-dathua-orange">Básico</h3>
                <p class="text-gray-400 text-xs mt-1">Para una sola sucursal</p>
              </div>
              <div class="w-11 h-11 shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 transition-all duration-300 group-hover:text-dathua-orange group-hover:bg-dathua-orange/10 group-hover:border-dathua-orange/40 group-hover:rotate-3 group-hover:scale-110">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </div>
            </div>

            <div class="mb-4">
              <div class="flex items-baseline gap-2">
                <span class="text-4xl lg:text-5xl font-extrabold text-white tracking-tight transition-transform duration-300 group-hover:scale-105 origin-left">$449</span>
                <span class="text-gray-400 text-xs font-medium uppercase tracking-wider">MXN / mes</span>
              </div>
              <p class="text-gray-400 text-xs mt-2">Ideal para comenzar a proteger tu infraestructura.</p>
            </div>

            <div class="h-px bg-white/10 my-6 transition-colors duration-300 group-hover:bg-dathua-orange/30"></div>

            <div class="space-y-3.5">
              <span class="text-[11px] font-semibold tracking-wider uppercase text-gray-400 block mb-2">Incluye</span>
              <div v-for="(feat, idx) in basicFeatures" :key="idx" class="flex items-center gap-3 text-xs text-gray-300">
                <div class="w-5 h-5 shrink-0 rounded-md bg-dathua-orange/10 border border-dathua-orange/30 flex items-center justify-center text-dathua-orange transition-all duration-300 group-hover:bg-dathua-orange/15">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                </div>
                <span>{{ feat }}</span>
              </div>
            </div>
          </div>

          <div class="relative z-10 mt-8 pt-4">
            <router-link to="/register" class="group/button relative w-full overflow-hidden inline-flex items-center justify-center rounded-xl border border-white/15 py-3 px-4 text-xs font-semibold text-white transition-all duration-300 ease-out hover:-translate-y-1 hover:border-dathua-orange hover:shadow-lg hover:shadow-dathua-orange/20">
              <span class="absolute inset-0 bg-dathua-orange translate-y-full group-hover/button:translate-y-0 transition-transform duration-300 ease-out"></span>
              <span class="relative z-10 flex items-center gap-2">
                Empezar prueba gratis
                <svg class="w-4 h-4 transition-transform duration-300 group-hover/button:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </span>
            </router-link>
          </div>
        </div>

        <!-- Plan Pro -->
        <div v-reveal="{ delay: 200 }" class="group relative flex flex-col justify-between bg-dathua-bg border-2 border-dathua-orange rounded-3xl p-8 overflow-visible transition-all duration-500 ease-out shadow-[0_0_40px_-10px_rgba(217,107,20,0.25)] md:-translate-y-2 hover:-translate-y-5 hover:scale-[1.02] hover:shadow-[0_30px_70px_rgba(217,107,20,0.28)]">
          <div class="absolute inset-0 rounded-3xl opacity-70 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(217,107,20,0.13),transparent_55%)]"></div>
          <div class="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-1 bg-dathua-orange group-hover:w-2/3 transition-all duration-500"></div>

          <div class="absolute -top-3.5 left-1/2 -translate-x-1/2">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest text-white bg-dathua-orange shadow-md shadow-dathua-orange/40 transition-transform duration-300 group-hover:scale-110">
              <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              Recomendado
            </span>
          </div>

          <div class="relative z-10">
            <div class="flex items-start justify-between gap-4 mb-6 mt-1">
              <div>
                <span class="text-dathua-orange text-xs font-semibold uppercase tracking-wider block mb-1">Para empresas</span>
                <h3 class="text-2xl font-bold text-white tracking-tight">Pro</h3>
                <p class="text-gray-400 text-xs mt-1">Hasta 3 sucursales</p>
              </div>
              <div class="w-11 h-11 shrink-0 rounded-xl bg-dathua-orange/15 border border-dathua-orange/40 flex items-center justify-center text-dathua-orange transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 group-hover:shadow-lg group-hover:shadow-dathua-orange/20">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 12a4 4 0 118 0 4 4 0 01-8 0zm0 0v6m8-6v6m-4-6V6" />
                </svg>
              </div>
            </div>

            <div class="mb-4">
              <div class="flex items-baseline gap-2">
                <span class="text-4xl lg:text-5xl font-extrabold text-white tracking-tight transition-transform duration-300 origin-left group-hover:scale-105">$1,199</span>
                <span class="text-gray-400 text-xs font-medium uppercase tracking-wider">MXN / mes</span>
              </div>
              <p class="text-gray-400 text-xs mt-2">Mayor capacidad para una infraestructura en crecimiento.</p>
            </div>

            <div class="h-px bg-white/10 my-6 transition-colors duration-300 group-hover:bg-dathua-orange/40"></div>

            <div class="space-y-3.5">
              <span class="text-[11px] font-semibold tracking-wider uppercase text-gray-400 block mb-2">Todo lo del plan básico, más</span>
              <div v-for="(feat, idx) in proFeatures" :key="idx" class="flex items-center gap-3 text-xs text-white">
                <div class="w-5 h-5 shrink-0 rounded-md bg-dathua-orange text-white flex items-center justify-center shadow-sm shadow-dathua-orange/50 transition-all duration-300 group-hover:scale-110">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                </div>
                <span>{{ feat }}</span>
              </div>
            </div>
          </div>

          <div class="relative z-10 mt-8 pt-4">
            <router-link to="/register" class="group/button relative w-full overflow-hidden inline-flex items-center justify-center rounded-xl bg-dathua-orange py-3 px-4 text-xs font-bold text-white transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl hover:shadow-dathua-orange/40">
              <span class="absolute top-0 -left-[120%] w-[60%] h-full bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-20deg] transition-all duration-700 group-hover/button:left-[140%]"></span>
              <span class="relative z-10 flex items-center gap-2">
                Empezar prueba gratis
                <svg class="w-4 h-4 transition-transform duration-300 group-hover/button:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </span>
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
const basicFeatures = [
  '1 sucursal',
  'Hasta 12 nodos monitoreados',
  'Detección de anomalías con IA',
  'Alertas en tiempo real',
  'Soporte por correo',
]

const proFeatures = [
  'Hasta 3 sucursales',
  'Hasta 45 nodos monitoreados (15 por sucursal)',
  'Detección avanzada de anomalías con IA',
  'Alertas en tiempo real prioritarias',
  'Soporte prioritario 24/7',
]
</script>
