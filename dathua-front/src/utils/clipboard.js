// navigator.clipboard solo existe en contextos seguros (https o
// localhost). El dashboard de desarrollo se abre como
// http://192.168.1.17:5173 desde otras máquinas de la red, y ahí el botón
// "Copiar" fallaba siempre. El respaldo con un <textarea> temporal +
// execCommand('copy') funciona también en http.
export async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }

  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  try {
    if (!document.execCommand('copy')) throw new Error('copy falló')
  } finally {
    document.body.removeChild(area)
  }
}
