<template>
  <div
    class="flex flex-col items-center text-center mx-auto"
    :class="size === 'lg' ? 'max-w-md py-14' : 'max-w-sm py-10'"
  >
    <div
      class="rounded-2xl bg-dathua-orange/10 border border-dathua-orange/30 flex items-center justify-center shrink-0"
      :class="size === 'lg' ? 'w-14 h-14 mb-5' : 'w-11 h-11 mb-4'"
    >
      <svg
        class="text-dathua-orange"
        :class="size === 'lg' ? 'w-7 h-7' : 'w-5 h-5'"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="1.6"
      >
        <path stroke-linecap="round" stroke-linejoin="round" :d="ICONS[icon] || ICONS.generic" />
      </svg>
    </div>

    <p class="font-medium text-white" :class="size === 'lg' ? 'text-base mb-1.5' : 'text-sm mb-1'">
      {{ title }}
    </p>
    <p v-if="description" class="text-dathua-text-soft" :class="size === 'lg' ? 'text-sm' : 'text-xs'">
      {{ description }}
    </p>

    <div v-if="$slots.default" class="mt-5">
      <slot />
    </div>
  </div>
</template>

<script setup>
// Empty state reutilizable: ícono + título + descripción + acción opcional
// (slot). Reemplaza los mensajes de solo texto que había repetidos en cada
// vista (Incidentes, IA Sentinel, Notificaciones, etc.) por un mismo
// patrón visual — el mismo que ya usaba OnboardingEmptyState, pero en una
// versión chica para listas dentro de tarjetas ("sm", default) y una
// versión grande para el cuerpo completo de una página ("lg").
defineProps({
  icon: { type: String, default: 'generic' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  size: { type: String, default: 'sm' }, // 'sm' | 'lg'
})

// Un solo trazo SVG por ícono (outline, mismo estilo que el resto del
// dashboard) — se eligen por nombre en vez de pasar el path completo cada
// vez que se usa el componente.
const ICONS = {
  generic: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2M5 21H3m16 0h-6M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 6v-3a1 1 0 011-1h1a1 1 0 011 1v3',
  incident: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  ai: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  nodes: 'M9 3H4v5h5V3zM20 3h-5v5h5V3zM9 16H4v5h5v-5zM20 16h-5v5h5v-5zM6.5 8v5m11-5v5M9 18.5h6M9 5.5h6',
  zone: 'M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z',
  search: 'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z',
  bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  chart: 'M9 19V6m0 13H6a1 1 0 01-1-1V9a1 1 0 011-1h3m0 11h6m-6 0V4a1 1 0 011-1h4a1 1 0 011 1v15m0 0h3a1 1 0 001-1v-8a1 1 0 00-1-1h-3',
  report: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  filter: 'M3 4a1 1 0 011-1h16a1 1 0 01.8 1.6l-6.3 8.4v5.5a1 1 0 01-1.447.894l-4-2A1 1 0 018.5 18.5v-4.5L2.2 5.6A1 1 0 013 4z',
}
</script>
