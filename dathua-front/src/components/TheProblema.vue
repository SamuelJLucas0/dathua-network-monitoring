<template>
  <section id="problema" class="scroll-mt-24 py-24 px-6 relative overflow-hidden">
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-dathua-orange/10 blur-[150px] rounded-full pointer-events-none -z-10"></div>

    <div class="max-w-6xl mx-auto">
      <div v-reveal class="text-center mb-16">
        <span class="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest text-dathua-orange bg-dathua-orange/10 border border-dathua-orange/30 mb-4">
          El problema
        </span>
        <h2 class="font-heading text-3xl md:text-4xl font-extrabold text-white tracking-tight">
          Ninguna opción actual <span class="text-dathua-orange">está pensada para ti</span>
        </h2>
        <p class="text-dathua-text-soft text-sm md:text-base mt-3 max-w-2xl mx-auto leading-relaxed">
          Las PyMEs suelen quedar atrapadas entre no monitorear su infraestructura o pagar por
          herramientas diseñadas para empresas mucho más grandes.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
        <!-- Problema 1: no monitorear -->
        <div v-reveal class="group relative flex flex-col bg-dathua-card/80 backdrop-blur-sm border border-dathua-border rounded-3xl p-8 overflow-hidden transition-all duration-500 ease-out hover:-translate-y-3 hover:scale-[1.02] hover:border-dathua-orange/50 hover:shadow-[0_25px_60px_rgba(217,107,20,0.12)]">
          <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,0.08),transparent_55%)]"></div>
          <div class="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-red-400 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>

          <div class="relative z-10">
            <div class="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-400/20 flex items-center justify-center mb-7 text-red-400 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:bg-red-500/15 group-hover:border-red-400/40 group-hover:shadow-lg group-hover:shadow-red-500/10">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <span class="text-[11px] font-semibold uppercase tracking-widest text-red-400/80 block mb-2">Riesgo operativo</span>
            <h3 class="font-heading text-2xl font-bold text-white tracking-tight mb-4 transition-colors duration-300 group-hover:text-red-300">
              No monitorear nada
            </h3>
            <p class="text-dathua-text-soft text-sm md:text-base leading-relaxed group-hover:text-gray-300 transition-colors duration-300">
              Te enteras de que algo falló hasta que un cliente no puede pagar, una cámara lleva
              horas sin grabar, o el negocio completo se detiene.
              <span class="text-gray-300">Reaccionas en vez de prevenir.</span>
            </p>
            <div class="mt-8">
              <div class="h-px w-10 bg-red-400/30 transition-all duration-500 group-hover:w-20 group-hover:bg-red-400"></div>
            </div>
          </div>
        </div>

        <!-- Problema 2: herramientas costosas -->
        <div v-reveal="{ delay: 120 }" class="group relative flex flex-col bg-dathua-card/80 backdrop-blur-sm border border-dathua-border rounded-3xl p-8 overflow-hidden transition-all duration-500 ease-out hover:-translate-y-3 hover:scale-[1.02] hover:border-dathua-orange/50 hover:shadow-[0_25px_60px_rgba(217,107,20,0.15)]">
          <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(217,107,20,0.12),transparent_55%)]"></div>
          <div class="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-dathua-orange to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>

          <div class="relative z-10">
            <div class="w-14 h-14 rounded-2xl bg-dathua-orange/10 border border-dathua-orange/25 flex items-center justify-center mb-7 text-dathua-orange transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:bg-dathua-orange/15 group-hover:border-dathua-orange/50 group-hover:shadow-lg group-hover:shadow-dathua-orange/20">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 9v1m0-9c-1.11 0-2.08.402-2.599 1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span class="text-[11px] font-semibold uppercase tracking-widest text-dathua-orange block mb-2">Costo excesivo</span>
            <h3 class="font-heading text-2xl font-bold text-white tracking-tight mb-4 transition-colors duration-300 group-hover:text-dathua-orange">
              Pagar herramientas de nivel corporativo
            </h3>
            <p class="text-dathua-text-soft text-sm md:text-base leading-relaxed group-hover:text-gray-300 transition-colors duration-300">
              PRTG, Datadog o SolarWinds están hechos para departamentos de TI grandes: precios
              desde <span class="text-white font-medium">$200 USD/mes</span>, una curva de
              aprendizaje alta y la necesidad de contar con alguien que entienda de redes.
            </p>
            <div class="mt-8">
              <div class="h-px w-10 bg-dathua-orange/30 transition-all duration-500 group-hover:w-20 group-hover:bg-dathua-orange"></div>
            </div>
          </div>
        </div>
      </div>

      <div v-reveal="{ delay: 250 }" class="mt-10 text-center">
        <div class="inline-flex items-center gap-2 text-xs text-gray-500">
          <span class="w-1.5 h-1.5 rounded-full bg-dathua-orange animate-pulse"></span>
          Existe un punto medio.
          <span class="text-gray-300 font-medium">Dathua.</span>
        </div>
      </div>
    </div>
  </section>
</template>
