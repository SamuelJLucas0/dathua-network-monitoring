<template>
  <section
    id="modelo"
    class="scroll-mt-24 py-24 px-6 relative overflow-hidden"
  >
    <!-- Glow ambiental centrado -->
    <div
      class="absolute top-1/2 left-1/2
             -translate-x-1/2 -translate-y-1/2
             w-[600px] h-[350px]
             bg-[#ea580c]/10
             blur-[150px]
             rounded-full
             pointer-events-none
             -z-10"
    ></div>

    <div class="max-w-5xl mx-auto">

      <!-- =========================
           ENCABEZADO
      ========================== -->

      <div v-reveal class="text-center mb-16">

        <span
          class="inline-block px-3 py-1 rounded-full
                 text-xs font-semibold uppercase tracking-widest
                 text-[#ea580c]
                 bg-[#ea580c]/10
                 border border-[#ea580c]/30
                 mb-4"
        >
          Modelo de negocio
        </span>

        <h2
          class="text-3xl md:text-4xl
                 font-extrabold text-white
                 tracking-tight"
        >
          Planes flexibles según tu infraestructura
        </h2>

        <p
          class="text-gray-400 text-sm md:text-base
                 mt-3 max-w-xl mx-auto"
        >
          Monitoreo inteligente y detección de anomalías adaptado
          a las necesidades de tu red.
        </p>

      </div>


      <!-- =========================
           GRID DE PLANES
      ========================== -->

      <div
        class="grid grid-cols-1 md:grid-cols-2
               gap-8 lg:gap-10
               items-stretch
               max-w-4xl mx-auto"
      >


        <!-- =========================
             PLAN BÁSICO
        ========================== -->

        <div
          v-reveal="{ delay: 100 }"
          class="group relative
                 flex flex-col justify-between

                 bg-[#11161f]/80
                 backdrop-blur-sm

                 border border-white/10
                 rounded-3xl
                 p-8
                 overflow-hidden

                 transition-all duration-500 ease-out

                 hover:-translate-y-3
                 hover:scale-[1.02]
                 hover:border-[#ea580c]/60
                 hover:shadow-[0_25px_60px_rgba(234,88,12,0.15)]"
        >

          <!-- Glow interno al hacer hover -->

          <div
            class="absolute inset-0
                   opacity-0
                   group-hover:opacity-100

                   transition-opacity duration-500

                   pointer-events-none

                   bg-[radial-gradient(circle_at_top_right,rgba(234,88,12,0.12),transparent_55%)]"
          ></div>


          <!-- Línea superior animada -->

          <div
            class="absolute top-0 left-0
                   w-full h-px

                   bg-gradient-to-r
                   from-transparent
                   via-[#ea580c]
                   to-transparent

                   scale-x-0
                   group-hover:scale-x-100

                   transition-transform duration-500"
          ></div>


          <!-- =========================
               CONTENIDO
          ========================== -->

          <div class="relative z-10">

            <!-- Header -->

            <div
              class="flex items-start justify-between
                     gap-4 mb-6"
            >

              <div>

                <span
                  class="text-gray-400 text-xs
                         font-semibold uppercase
                         tracking-wider block mb-1"
                >
                  Plan inicial
                </span>

                <h3
                  class="text-2xl font-bold
                         text-white tracking-tight
                         transition-colors duration-300
                         group-hover:text-[#ea580c]"
                >
                  Básico
                </h3>

                <p class="text-gray-400 text-xs mt-1">
                  Para una sola sucursal
                </p>

              </div>


              <!-- Icono -->

              <div
                class="w-11 h-11 shrink-0
                       rounded-xl

                       bg-white/5
                       border border-white/10

                       flex items-center justify-center

                       text-gray-300

                       transition-all duration-300

                       group-hover:text-[#ea580c]
                       group-hover:bg-[#ea580c]/10
                       group-hover:border-[#ea580c]/40
                       group-hover:rotate-3
                       group-hover:scale-110"
              >

                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>

              </div>

            </div>


            <!-- =========================
                 PRECIO
            ========================== -->

            <div class="mb-4">

              <div class="flex items-baseline gap-2">

                <span
                  class="text-4xl lg:text-5xl
                         font-extrabold text-white
                         tracking-tight
                         transition-transform duration-300
                         group-hover:scale-105
                         origin-left"
                >
                  $449
                </span>

                <span
                  class="text-gray-400 text-xs
                         font-medium uppercase
                         tracking-wider"
                >
                  MXN / mes
                </span>

              </div>

              <p class="text-gray-400 text-xs mt-2">
                Ideal para comenzar a proteger tu infraestructura.
              </p>

            </div>


            <!-- Separador -->

            <div
              class="h-px bg-white/10 my-6
                     transition-colors duration-300
                     group-hover:bg-[#ea580c]/30"
            ></div>


            <!-- =========================
                 CARACTERÍSTICAS
            ========================== -->

            <div class="space-y-3.5">

              <span
                class="text-[11px]
                       font-semibold
                       tracking-wider
                       uppercase
                       text-gray-400
                       block mb-2"
              >
                Incluye
              </span>


              <div
                v-for="(feat, idx) in basicFeatures"
                :key="idx"
                class="flex items-center gap-3
                       text-xs text-gray-300"
              >

                <!-- Check -->

                <div
                  class="w-5 h-5 shrink-0
                         rounded-md

                         bg-[#ea580c]/10
                         border border-[#ea580c]/30

                         flex items-center justify-center

                         text-[#ea580c]

                         transition-all duration-300

                         group-hover:bg-[#ea580c]/15"
                >

                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-3.5 h-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>

                </div>

                <span>{{ feat }}</span>

              </div>

            </div>

          </div>


          <!-- =========================
               BOTÓN BÁSICO
          ========================== -->

          <div class="relative z-10 mt-8 pt-4">

            <a
              href="#contacto"

              class="group/button
                     relative
                     w-full
                     overflow-hidden

                     inline-flex
                     items-center
                     justify-center

                     rounded-xl

                     border border-white/15

                     py-3 px-4

                     text-xs font-semibold
                     text-white

                     transition-all duration-300 ease-out

                     hover:-translate-y-1
                     hover:border-[#ea580c]
                     hover:shadow-lg
                     hover:shadow-[#ea580c]/20"
            >

              <!-- Fondo naranja animado -->

              <span
                class="absolute inset-0
                       bg-[#ea580c]

                       translate-y-full

                       group-hover/button:translate-y-0

                       transition-transform
                       duration-300
                       ease-out"
              ></span>


              <!-- Contenido -->

              <span
                class="relative z-10
                       flex items-center
                       gap-2"
              >

                Empezar prueba gratis

                <svg
                  class="w-4 h-4
                         transition-transform duration-300
                         group-hover/button:translate-x-1"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>

              </span>

            </a>

          </div>

        </div>



        <!-- =========================
             PLAN PRO
        ========================== -->

        <div
          v-reveal="{ delay: 200 }"

          class="group relative
                 flex flex-col justify-between

                 bg-[#141b26]

                 border-2 border-[#ea580c]

                 rounded-3xl
                 p-8

                 overflow-visible

                 transition-all duration-500 ease-out

                 shadow-[0_0_40px_-10px_rgba(234,88,12,0.25)]

                 md:-translate-y-2

                 hover:-translate-y-5
                 hover:scale-[1.02]
                 hover:shadow-[0_30px_70px_rgba(234,88,12,0.28)]"
        >

          <!-- Fondo iluminado -->

          <div
            class="absolute inset-0
                   rounded-3xl
                   opacity-70

                   pointer-events-none

                   bg-[radial-gradient(circle_at_top_right,rgba(234,88,12,0.13),transparent_55%)]"
          ></div>


          <!-- Línea decorativa -->

          <div
            class="absolute top-0 left-1/2
                   -translate-x-1/2

                   w-0 h-1

                   bg-[#ea580c]

                   group-hover:w-2/3

                   transition-all duration-500"
          ></div>


          <!-- =========================
               BADGE
          ========================== -->

          <div
            class="absolute
                   -top-3.5
                   left-1/2
                   -translate-x-1/2"
          >

            <span
              class="inline-flex items-center gap-1.5
                     px-3 py-1

                     rounded-full

                     text-[11px]
                     font-bold
                     uppercase
                     tracking-widest

                     text-white
                     bg-[#ea580c]

                     shadow-md
                     shadow-[#ea580c]/40

                     transition-transform duration-300

                     group-hover:scale-110"
            >

              <span
                class="w-1.5 h-1.5
                       rounded-full
                       bg-white
                       animate-pulse"
              ></span>

              Recomendado

            </span>

          </div>


          <!-- =========================
               CONTENIDO
          ========================== -->

          <div class="relative z-10">

            <!-- Header -->

            <div
              class="flex items-start justify-between
                     gap-4 mb-6 mt-1"
            >

              <div>

                <span
                  class="text-[#ea580c]
                         text-xs font-semibold
                         uppercase tracking-wider
                         block mb-1"
                >
                  Para empresas
                </span>

                <h3
                  class="text-2xl
                         font-bold text-white
                         tracking-tight"
                >
                  Pro
                </h3>

                <p class="text-gray-400 text-xs mt-1">
                  Hasta 3 sucursales
                </p>

              </div>


              <!-- Icono -->

              <div
                class="w-11 h-11 shrink-0
                       rounded-xl

                       bg-[#ea580c]/15
                       border border-[#ea580c]/40

                       flex items-center justify-center

                       text-[#ea580c]

                       transition-all duration-300

                       group-hover:scale-110
                       group-hover:rotate-6
                       group-hover:shadow-lg
                       group-hover:shadow-[#ea580c]/20"
              >

                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M8 12a4 4 0 118 0 4 4 0 01-8 0zm0 0v6m8-6v6m-4-6V6"
                  />
                </svg>

              </div>

            </div>


            <!-- =========================
                 PRECIO
            ========================== -->

            <div class="mb-4">

              <div class="flex items-baseline gap-2">

                <span
                  class="text-4xl lg:text-5xl
                         font-extrabold text-white
                         tracking-tight

                         transition-transform duration-300
                         origin-left

                         group-hover:scale-105"
                >
                  $1,199
                </span>

                <span
                  class="text-gray-400 text-xs
                         font-medium uppercase
                         tracking-wider"
                >
                  MXN / mes
                </span>

              </div>

              <p class="text-gray-400 text-xs mt-2">
                Mayor capacidad para una infraestructura en crecimiento.
              </p>

            </div>


            <!-- Separador -->

            <div
              class="h-px
                     bg-white/10
                     my-6

                     transition-colors duration-300

                     group-hover:bg-[#ea580c]/40"
            ></div>


            <!-- =========================
                 CARACTERÍSTICAS
            ========================== -->

            <div class="space-y-3.5">

              <span
                class="text-[11px]
                       font-semibold
                       tracking-wider
                       uppercase
                       text-gray-400
                       block mb-2"
              >
                Todo lo del plan básico, más
              </span>


              <div
                v-for="(feat, idx) in proFeatures"
                :key="idx"

                class="flex items-center gap-3
                       text-xs text-white"
              >

                <div
                  class="w-5 h-5 shrink-0
                         rounded-md

                         bg-[#ea580c]
                         text-white

                         flex items-center
                         justify-center

                         shadow-sm
                         shadow-[#ea580c]/50

                         transition-all duration-300

                         group-hover:scale-110"
                >

                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-3.5 h-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>

                </div>

                <span>{{ feat }}</span>

              </div>

            </div>

          </div>


          <!-- =========================
               BOTÓN PRO
          ========================== -->

          <div class="relative z-10 mt-8 pt-4">

            <a
              href="#contacto"

              class="group/button
                     relative
                     w-full
                     overflow-hidden

                     inline-flex
                     items-center
                     justify-center

                     rounded-xl

                     bg-[#ea580c]

                     py-3 px-4

                     text-xs font-bold
                     text-white

                     transition-all duration-300 ease-out

                     hover:-translate-y-1
                     hover:scale-[1.02]

                     hover:shadow-xl
                     hover:shadow-[#ea580c]/40"
            >

              <!-- Efecto de brillo -->

              <span
                class="absolute
                       top-0
                       -left-[120%]

                       w-[60%]
                       h-full

                       bg-gradient-to-r
                       from-transparent
                       via-white/30
                       to-transparent

                       skew-x-[-20deg]

                       transition-all
                       duration-700

                       group-hover/button:left-[140%]"
              ></span>


              <!-- Contenido -->

              <span
                class="relative z-10
                       flex items-center
                       gap-2"
              >

                Empezar prueba gratis

                <svg
                  class="w-4 h-4
                         transition-transform duration-300
                         group-hover/button:translate-x-1"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>

              </span>

            </a>

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
  'Soporte por correo'
]

const proFeatures = [
  'Hasta 3 sucursales',
  'Hasta 45 nodos monitoreados (15 por sucursal)',
  'Detección avanzada de anomalías con IA',
  'Alertas en tiempo real prioritarias',
  'Soporte prioritario 24/7'
]

</script>