<template>
  <section
    id="equipo"
    class="scroll-mt-24 py-24 px-6 relative overflow-hidden"
  >
    <!-- =========================
         FONDO DECORATIVO
    ========================== -->

    <div class="absolute inset-0 pointer-events-none -z-10">
      <div
        class="absolute top-1/2 left-1/4 w-96 h-96
               bg-dathua-orange/5 rounded-full
               blur-[140px] animate-glow"
      ></div>

      <div
        class="absolute bottom-1/2 right-1/4 w-80 h-80
               bg-dathua-orange/5 rounded-full
               blur-[120px] animate-glow"
        style="animation-delay: -4s"
      ></div>

      <div
        class="absolute top-1/3 left-1/2 w-56 h-56
               bg-dathua-orange/10 rounded-full
               blur-[100px]"
      ></div>
    </div>


    <div class="max-w-6xl mx-auto">

      <!-- =========================
           ENCABEZADO
      ========================== -->

      <div
        v-reveal
        class="text-center mb-16 relative"
      >
        <!-- Badge -->

        <span
          class="inline-block px-4 py-1.5 rounded-full
                 text-xs font-medium uppercase tracking-widest
                 text-dathua-orange
                 bg-dathua-orange/10
                 border border-dathua-orange/30
                 mb-5 backdrop-blur-sm"
        >
          Equipo
        </span>


        <!-- Título -->

        <h2
          class="font-heading text-3xl md:text-4xl lg:text-5xl
                 font-bold text-white tracking-tight leading-tight"
        >
          Quiénes estamos detrás de

          <span class="relative inline-block">
            <span class="text-dathua-orange">
              DatHua
            </span>

            <span
              class="absolute -bottom-1.5 left-0 w-full h-[3px]
                     bg-gradient-to-r
                     from-transparent
                     via-dathua-orange
                     to-transparent
                     opacity-70"
            ></span>
          </span>
        </h2>


        <!-- Descripción -->

        <p
          class="text-dathua-text-soft text-sm md:text-base
                 mt-4 max-w-2xl mx-auto leading-relaxed"
        >
          Ingeniería, análisis y desarrollo enfocados en la observabilidad y

          <span class="text-white/80">
            protección de infraestructura de red.
          </span>
        </p>


        <!-- Separador -->

        <div class="mt-6 flex justify-center gap-3">
          <span
            class="w-8 h-px bg-dathua-orange/30 rounded-full"
          ></span>

          <span
            class="w-16 h-px bg-dathua-orange/50 rounded-full"
          ></span>

          <span
            class="w-8 h-px bg-dathua-orange/30 rounded-full"
          ></span>
        </div>
      </div>


      <!-- =========================
           GRID DEL EQUIPO
      ========================== -->

      <div
        class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6"
      >
        <article
          v-for="(member, i) in team"
          :key="member.name"
          v-reveal="{ delay: i * 100 }"
          class="group relative min-h-[310px] overflow-hidden
                 rounded-2xl bg-dathua-card
                 border border-dathua-border

                 transition-all duration-500 ease-out

                 hover:-translate-y-2
                 hover:border-dathua-orange/50
                 hover:shadow-[0_20px_50px_rgba(217,107,20,0.10)]"
        >

          <!-- Fondo de iluminación en hover -->

          <div
            class="absolute inset-0
                   opacity-0 group-hover:opacity-100
                   transition-opacity duration-500
                   pointer-events-none

                   bg-[radial-gradient(circle_at_top_right,rgba(217,107,20,0.10),transparent_50%)]"
          ></div>


          <!-- Línea superior animada -->

          <div
            class="absolute top-0 left-0 w-full h-px

                   bg-gradient-to-r
                   from-transparent
                   via-dathua-orange
                   to-transparent

                   scale-x-0
                   group-hover:scale-x-100

                   transition-transform duration-500"
          ></div>


          <!-- Contenido -->

          <div
            class="relative z-10 h-full min-h-[310px]
                   flex flex-col p-6"
          >

            <!-- =========================
                 HEADER DE LA TARJETA
            ========================== -->

            <div
              class="flex items-start justify-between mb-7"
            >

              <!-- Avatar / Iniciales -->

              <div
                class="w-14 h-14 rounded-xl

                       bg-gradient-to-br
                       from-dathua-orange/20
                       to-dathua-orange/5

                       border border-dathua-orange/30

                       flex items-center justify-center

                       font-heading font-bold text-lg
                       text-dathua-orange

                       transition-all duration-300

                       group-hover:border-dathua-orange/70
                       group-hover:scale-105
                       group-hover:shadow-[0_0_25px_rgba(217,107,20,0.18)]"
              >
                {{ member.initials }}
              </div>


              <!-- Número del miembro -->

              <span
                class="font-heading text-xs
                       tracking-[0.2em]
                       text-dathua-text-soft/30"
              >
                {{ String(i + 1).padStart(2, '0') }}
              </span>

            </div>


            <!-- =========================
                 INFORMACIÓN
            ========================== -->

            <div class="flex-1">

              <!-- Nombre -->

              <h3
                class="font-heading text-lg font-semibold
                       text-white leading-tight mb-3

                       transition-colors duration-300

                       group-hover:text-dathua-orange"
              >
                {{ member.name }}
              </h3>


              <!-- Área / Línea decorativa -->

              <div
                class="flex items-center gap-2 mb-4"
              >
                <div
                  class="w-7 h-px bg-dathua-orange

                         transition-all duration-300

                         group-hover:w-12"
                ></div>

                <span
                  class="text-[10px]
                         uppercase
                         tracking-[0.18em]
                         text-dathua-orange/70"
                >
                  DatHua
                </span>
              </div>


              <!-- Rol -->

              <p
                class="text-sm text-dathua-text-soft
                       leading-relaxed"
              >
                {{ member.role }}
              </p>

            </div>


            <!-- =========================
                 FOOTER
            ========================== -->

            <div
              class="pt-5 mt-6
                     border-t border-dathua-border/60"
            >

              <!-- LinkedIn -->

              <a
                v-if="member.linkedin"
                :href="member.linkedin"
                target="_blank"
                rel="noopener noreferrer"

                class="inline-flex items-center gap-2

                       text-xs font-medium
                       text-dathua-text-soft

                       transition-all duration-300

                       hover:text-dathua-orange"
              >

                <!-- Icono LinkedIn -->

                <svg
                  class="w-4 h-4 shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    d="M19 3A2 2 0 0 1 21 5v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14ZM8.34 18.34v-7.17H5.96v7.17h2.38ZM7.15 10.19c.76 0 1.38-.62 1.38-1.38 0-.77-.62-1.39-1.38-1.39-.77 0-1.39.62-1.39 1.39 0 .76.62 1.38 1.39 1.38Zm11.19 8.15v-4.01c0-2.15-.46-3.8-2.97-3.8-1.21 0-2.02.66-2.35 1.29h-.03v-1.1h-2.28v7.62h2.38v-3.77c0-.99.19-1.95 1.42-1.95 1.21 0 1.23 1.13 1.23 2.01v3.71h2.38Z"
                  />
                </svg>


                <span>
                  Ver perfil profesional
                </span>


                <!-- Flecha -->

                <svg
                  class="w-3 h-3
                         transition-transform duration-300
                         group-hover:translate-x-1"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M5 12h14"></path>

                  <path d="m13 6 6 6-6 6"></path>
                </svg>

              </a>


              <!-- Miembro sin LinkedIn -->

              <div
                v-else
                class="flex items-center gap-2
                       text-xs text-dathua-text-soft/50"
              >

                <span
                  class="w-2 h-2 rounded-full
                         bg-dathua-orange/60"
                ></span>

                <span>
                  Miembro de DatHua Core
                </span>

              </div>

            </div>

          </div>

        </article>

      </div>


      <!-- =========================
           CONTACTO
      ========================== -->

      <div
        v-reveal="{ delay: 400 }"
        class="text-center mt-14 relative"
      >

        <div
          class="w-24 h-px
                 bg-gradient-to-r
                 from-transparent
                 via-dathua-orange/30
                 to-transparent
                 mx-auto mb-4"
        ></div>


        <p class="text-dathua-text-soft text-sm">

          ¿Quieres saber más del proyecto?

          <a
            href="mailto:dathuaapp@gmail.com"

            class="text-dathua-orange
                   hover:text-dathua-orange-hover

                   font-medium ml-1

                   transition-colors duration-300

                   hover:underline
                   underline-offset-2"
          >
            dathuaapp@gmail.com
          </a>

        </p>

      </div>

    </div>

  </section>
</template>


<script setup>

const team = [
  {
    name: 'Samuel Juárez Lucas',
    role: 'Líder del proyecto y programador',
    initials: 'SJ',
    linkedin:
      'https://www.linkedin.com/in/samuel-juarez-lucas-8804a438b'
  },

  {
    name: 'Emiliano Arias Villafaña',
    role:
      'Inteligencia artificial, machine learning y manejo de bases de datos',
    initials: 'EA',
    linkedin:
      'https://www.linkedin.com/in/emiliano-arias-villafa%C3%B1a-a34547194'
  },

  {
    name: 'Christopher Eduardo Barrientos Guerra',
    role: 'Ingeniero y desarrollador de software',
    initials: 'CB',
    linkedin:
      'https://www.linkedin.com/in/christopher-eduardo-barrientos-guerra-968851433'
  },

  {
    name: 'Jose Luis Garcia',
    role: 'Ventas e ingeniería en computación',
    initials: 'JG',
    linkedin: null
  }
]

</script>