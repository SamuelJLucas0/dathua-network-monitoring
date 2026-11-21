<template>
  <section id="solucion" class="scroll-mt-24 py-24 px-6 relative overflow-hidden">
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-dathua-orange/10 blur-[150px] rounded-full pointer-events-none -z-10"></div>

    <div class="max-w-6xl mx-auto">
      <div v-reveal class="text-center mb-16">
        <span class="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest text-dathua-orange bg-dathua-orange/10 border border-dathua-orange/30 mb-4">
          La solución
        </span>
        <h2 class="font-heading text-3xl md:text-4xl font-extrabold text-white tracking-tight">
          Todo lo que una PyME necesita, <span class="text-dathua-orange">nada de lo que no</span>
        </h2>
        <p class="text-dathua-text-soft text-sm md:text-base mt-3 max-w-2xl mx-auto leading-relaxed">
          Una plataforma de monitoreo pensada para que puedas conocer, proteger y entender tu
          infraestructura de red sin complicaciones.
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        <div
          v-for="(item, i) in features"
          :key="item.title"
          v-reveal="{ delay: i * 100 }"
          class="group relative flex flex-col bg-dathua-card/80 backdrop-blur-sm border border-dathua-border rounded-3xl p-7 overflow-hidden transition-all duration-500 ease-out hover:-translate-y-3 hover:scale-[1.02] hover:border-dathua-orange/60 hover:shadow-[0_25px_60px_rgba(217,107,20,0.15)]"
        >
          <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(217,107,20,0.13),transparent_55%)]"></div>
          <div class="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-dathua-orange to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>

          <div class="relative z-10 flex flex-col h-full">
            <div class="w-12 h-12 rounded-xl bg-dathua-orange/10 border border-dathua-orange/25 flex items-center justify-center text-dathua-orange mb-6 transition-all duration-300 group-hover:bg-dathua-orange/15 group-hover:border-dathua-orange/50 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-lg group-hover:shadow-dathua-orange/20">
              <div class="transition-transform duration-300" v-html="item.icon"></div>
            </div>
            <h3 class="font-heading text-lg text-white font-semibold tracking-tight mb-3 transition-colors duration-300 group-hover:text-dathua-orange">
              {{ item.title }}
            </h3>
            <p class="text-dathua-text-soft text-sm leading-relaxed transition-colors duration-300 group-hover:text-gray-300">
              {{ item.desc }}
            </p>
            <div class="mt-auto pt-6">
              <div class="h-px w-8 bg-dathua-orange/30 transition-all duration-500 group-hover:w-16 group-hover:bg-dathua-orange"></div>
            </div>
          </div>
        </div>

        <!-- Reportes de auditoría -->
        <div v-reveal="{ delay: 500 }" class="group relative flex flex-col bg-dathua-card/80 backdrop-blur-sm border border-dathua-border rounded-3xl p-7 overflow-hidden transition-all duration-500 ease-out hover:-translate-y-3 hover:scale-[1.02] hover:border-dathua-orange/60 hover:shadow-[0_25px_60px_rgba(217,107,20,0.15)]">
          <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(217,107,20,0.13),transparent_55%)]"></div>
          <div class="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-dathua-orange to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>

          <div class="relative z-10 flex flex-col h-full">
            <div class="w-12 h-12 rounded-xl bg-dathua-orange/10 border border-dathua-orange/25 flex items-center justify-center text-dathua-orange mb-6 transition-all duration-300 group-hover:bg-dathua-orange/15 group-hover:border-dathua-orange/50 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-lg group-hover:shadow-dathua-orange/20">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 class="font-heading text-lg text-white font-semibold tracking-tight mb-3 transition-colors duration-300 group-hover:text-dathua-orange">
              Reportes para auditorías
            </h3>
            <p class="text-dathua-text-soft text-sm leading-relaxed transition-colors duration-300 group-hover:text-gray-300">
              Genera un historial exportable de la disponibilidad y desempeño de tu red, listo
              para mostrar a un cliente, socio o auditor cuando necesites comprobar que todo
              estuvo en orden.
            </p>
            <div class="mt-auto pt-6">
              <div class="h-px w-8 bg-dathua-orange/30 transition-all duration-500 group-hover:w-16 group-hover:bg-dathua-orange"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
const features = [
  {
    title: 'Precio accesible',
    desc: 'Hasta 70% más barato que las herramientas de monitoreo tradicionales.',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 9v1m0-9c-1.11 0-2.08.402-2.599 1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>`,
  },
  {
    title: 'Sin experiencia técnica',
    desc: 'Conecta tu sucursal con una sola clave de acceso y listo, sin instalar nada complicado ni contratar a un técnico.',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>`,
  },
  {
    title: 'Se adapta a tu negocio',
    desc: 'Aprende cómo se comporta normalmente tu red día a día y te avisa cuando algo se sale de lo normal, antes de que se vuelva un problema grande.',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>`,
  },
  {
    title: 'Multi-sucursal',
    desc: 'Pensado desde el diseño para negocios con hasta 3 ubicaciones, manteniendo toda tu infraestructura bajo control.',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2M5 21H3m16 0h-6M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 6v-3a1 1 0 011-1h1a1 1 0 011 1v3" />
    </svg>`,
  },
]
</script>
