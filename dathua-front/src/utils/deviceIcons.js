// Un ícono simple por tipo de dispositivo — se usa tanto en el selector
// del formulario como en las filas del árbol de equipos, para que un
// vistazo rápido ya diga "esto es una cámara" sin leer la etiqueta.
export const DEVICE_ICONS = {
  router: '<svg class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16h16M4 16a2 2 0 00-2 2v1a1 1 0 001 1h18a1 1 0 001-1v-1a2 2 0 00-2-2M4 16l1.5-5h13L20 16M8 8V5m4 3V4m4 4V6" /></svg>',
  switch: '<svg class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><rect x="3" y="7" width="18" height="10" rx="1.5" stroke-linecap="round" stroke-linejoin="round" /><path stroke-linecap="round" stroke-linejoin="round" d="M7 10h.01M11 10h.01M15 10h.01M17 10h.01M7 14h10" /></svg>',
  access_point: '<svg class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18v.01M8.5 14.5a5 5 0 017 0M5.5 11.5a9 9 0 0113 0M12 18a1 1 0 100-2 1 1 0 000 2z" /></svg>',
  camera: '<svg class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8a2 2 0 012-2h2l1.5-2h5L16 6h2a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" /><circle cx="12" cy="13" r="3" stroke-linecap="round" stroke-linejoin="round" /></svg>',
  server: '<svg class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="6" rx="1" /><rect x="4" y="14" width="16" height="6" rx="1" /><path stroke-linecap="round" d="M7 7h.01M7 17h.01" /></svg>',
  endpoint: '<svg class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="12" rx="1.5" /><path stroke-linecap="round" stroke-linejoin="round" d="M8 20h8M12 16v4" /></svg>',
}

export const DEVICE_TYPES = ['router', 'switch', 'access_point', 'camera', 'server', 'endpoint']
