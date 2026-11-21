const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
const MAC_RE = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/

export function isValidIPv4(value) {
  return IPV4_RE.test(value.trim())
}

export function isValidMac(value) {
  return MAC_RE.test(value.trim())
}

export function ipError(value) {
  if (!value.trim()) return 'La dirección IP es obligatoria'
  if (!isValidIPv4(value)) return 'Formato inválido — usa algo como 192.168.1.1'
  return ''
}

export function macError(value) {
  if (!value.trim()) return ''
  if (!isValidMac(value)) return 'Formato inválido — usa algo como AA:BB:CC:DD:EE:FF'
  return ''
}
