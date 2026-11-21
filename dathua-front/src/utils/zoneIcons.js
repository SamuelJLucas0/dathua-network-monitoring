// Ícono personalizable por zona — igual que deviceIcons.js pero para
// áreas físicas en vez de tipos de equipo, así "Piso 1" y "Bodega" se
// distinguen de un vistazo en la tarjeta de la zona.
export const ZONE_ICONS = {
  building: '<svg class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2M5 21H3m16 0h-6M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 6v-3a1 1 0 011-1h1a1 1 0 011 1v3" /></svg>',
  floor: '<svg class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4l9 5-9 5-9-5 9-5zM3 14l9 5 9-5" /></svg>',
  warehouse: '<svg class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 21V10l9-6 9 6v11M3 21h18M8 21v-6h8v6" /></svg>',
  office: '<svg class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="1.5" /><path stroke-linecap="round" stroke-linejoin="round" d="M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1M10 21v-4h4v4" /></svg>',
  outdoor: '<svg class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21c-4-4.5-6.5-8-6.5-11a6.5 6.5 0 1113 0c0 3-2.5 6.5-6.5 11z" /><circle cx="12" cy="10" r="2.3" stroke-linecap="round" stroke-linejoin="round" /></svg>',
  server_room: '<svg class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="7" rx="1" /><rect x="4" y="14" width="16" height="7" rx="1" /><path stroke-linecap="round" d="M7 6.5h.01M7 17.5h.01M11 6.5h6M11 17.5h6" /></svg>',
}

export const ZONE_ICON_TYPES = ['building', 'floor', 'warehouse', 'office', 'outdoor', 'server_room']

export const ZONE_ICON_LABELS = {
  building: 'Edificio',
  floor: 'Piso',
  warehouse: 'Bodega',
  office: 'Oficina',
  outdoor: 'Exterior',
  server_room: 'Cuarto de red',
}
