// Heurístico de clasificación de dispositivos descubiertos en la LAN del
// cliente. Vive del lado del servidor a propósito: el agente (.exe
// distribuido a cada cliente) solo manda evidencia cruda (MAC, hostname,
// puertos abiertos) — así, ajustar o mejorar este heurístico no requiere
// recompilar ni redistribuir el agente a nadie.
//
// Es un heurístico, no una verdad absoluta: el resultado es siempre una
// "sugerencia" editable por el dueño de la sucursal al aprobar el candidato.

const MAC_OUI_VENDORS = {
  '00:40:8c': 'Dahua',
  'bc:ad:28': 'Hikvision',
  '4c:11:bf': 'Hikvision',
  'e0:50:8b': 'Reolink',
  '00:15:6d': 'Ubiquiti',
  'f0:9f:c2': 'Ubiquiti',
  '00:0c:42': 'MikroTik',
  '4c:5e:0c': 'TP-Link',
  '00:14:78': 'TP-Link',
  '00:1a:2b': 'Cisco',
  '00:1b:d4': 'HP',
  '00:1f:29': 'HP',
  '3c:d9:2b': 'HP',
  'ac:16:2d': 'Cisco',
  '00:26:73': 'Brother',
  '00:80:77': 'Brother',
  '00:1e:8f': 'Epson',
  '3c:e5:a6': 'Canon'
};

const CAMERA_PORTS = [554]; // RTSP
const PRINTER_PORTS = [9100];
const NETWORK_GEAR_VENDORS = /ubiquiti|mikrotik|tp-link|cisco/i;
const NETWORK_GEAR_PORTS = [22, 23];

// Palabras que suelen aparecer en sysDescr (SNMP) de cada tipo de equipo
// administrado — mucho más confiable que MAC+puertos porque es el propio
// dispositivo describiéndose a sí mismo, en vez de una adivinanza nuestra.
// Se revisan en este orden porque "access point"/"router" a veces
// aparecen juntos en el mismo sysDescr (ej. un router con radio Wi-Fi
// integrada) — el primer match gana.
const SYS_DESCR_PATTERNS = [
  { type: 'router', re: /\brouter\b|\bgateway\b|routeros/i },
  { type: 'access_point', re: /access point|\bap\b|wireless|wi-?fi/i },
  { type: 'switch', re: /\bswitch\b/i },
  { type: 'server', re: /linux|windows server|freebsd|vmware|hyper-v/i }
];

function lookupVendor(mac) {
  if (!mac) return null;
  const prefix = mac.slice(0, 8).toLowerCase();
  return MAC_OUI_VENDORS[prefix] || null;
}

function classifyBySnmp(sysDescr) {
  if (!sysDescr) return null;
  const match = SYS_DESCR_PATTERNS.find((p) => p.re.test(sysDescr));
  return match ? match.type : null;
}

// classifyDevice({ mac, hostname, openPorts, snmp }) -> { suggestedDeviceType, suggestedVendor }
// `snmp` es opcional: { sysDescr, sysObjectId, sysName } — solo llega si
// el dispositivo contestó SNMP (ver snmp_discovery.py del agente). Su
// ausencia es el caso normal (switch no administrado, cámara, endpoint),
// no un error, y el heurístico de MAC/puertos de siempre sigue aplicando.
export function classifyDevice({ mac, hostname, openPorts = [], snmp = null } = {}) {
  const suggestedVendor = lookupVendor(mac);

  const bySnmp = classifyBySnmp(snmp?.sysDescr);
  if (bySnmp) {
    return { suggestedDeviceType: bySnmp, suggestedVendor };
  }

  if (openPorts.some((p) => CAMERA_PORTS.includes(p))) {
    return { suggestedDeviceType: 'camera', suggestedVendor };
  }

  if (openPorts.some((p) => PRINTER_PORTS.includes(p))) {
    return { suggestedDeviceType: 'endpoint', suggestedVendor };
  }

  if (
    suggestedVendor &&
    NETWORK_GEAR_VENDORS.test(suggestedVendor) &&
    openPorts.some((p) => NETWORK_GEAR_PORTS.includes(p))
  ) {
    return { suggestedDeviceType: 'router', suggestedVendor };
  }

  return { suggestedDeviceType: 'endpoint', suggestedVendor };
}
