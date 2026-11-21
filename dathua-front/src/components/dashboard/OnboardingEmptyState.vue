<template>
  <div class="flex flex-col items-center text-center max-w-lg mx-auto py-16">
    <div class="w-16 h-16 rounded-2xl bg-dathua-orange/10 border border-dathua-orange/30 flex items-center justify-center mb-6">
      <svg class="w-8 h-8 text-dathua-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2M5 21H3m16 0h-6M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 6v-3a1 1 0 011-1h1a1 1 0 011 1v3" />
      </svg>
    </div>

    <h1 class="font-heading text-2xl font-bold text-white mb-2">Vamos a armar tu red</h1>
    <p class="text-dathua-text-soft text-sm mb-10">
      Todavía no tienes sucursales dadas de alta. En unos minutos puedes tener tu primera
      sucursal monitoreada de principio a fin.
    </p>

    <div class="w-full space-y-4 mb-10 text-left">
      <div class="flex gap-4 items-start">
        <span class="w-7 h-7 rounded-full bg-dathua-orange text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
        <div>
          <p class="text-sm text-white font-medium">Crea tu primera sucursal</p>
          <p class="text-xs text-dathua-text-soft mt-0.5">Solo necesitas un nombre — la dirección es opcional.</p>
        </div>
      </div>
      <div class="flex gap-4 items-start opacity-60">
        <span class="w-7 h-7 rounded-full bg-dathua-card border border-dathua-border text-dathua-text-soft text-xs font-bold flex items-center justify-center shrink-0">2</span>
        <div>
          <p class="text-sm text-white font-medium">Instala el agente ahí</p>
          <p class="text-xs text-dathua-text-soft mt-0.5">Te damos una llave única para conectarlo de forma segura.</p>
        </div>
      </div>
      <div class="flex gap-4 items-start opacity-60">
        <span class="w-7 h-7 rounded-full bg-dathua-card border border-dathua-border text-dathua-text-soft text-xs font-bold flex items-center justify-center shrink-0">3</span>
        <div>
          <p class="text-sm text-white font-medium">Aprueba lo que el agente encuentre</p>
          <p class="text-xs text-dathua-text-soft mt-0.5">Routers, switches, cámaras, servidores — tú decides qué monitorear.</p>
        </div>
      </div>
    </div>

    <button
      type="button"
      class="px-6 py-3 rounded-lg text-sm font-semibold bg-dathua-orange text-white hover:bg-[#B45309] transition-colors duration-200 cursor-pointer"
      @click="$emit('create')"
    >
      Crear tu primera sucursal
    </button>
  </div>
</template>

<script setup>
defineEmits(['create'])
</script>
