import { io } from 'socket.io-client'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
// El servidor de Socket.IO cuelga del mismo host que la API REST, pero sin
// el prefijo /api (vive en la raíz del servidor HTTP).
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '')

let socket = null
let currentSiteRoom = null

// Se conecta una sola vez por sesión — llamar de nuevo con el mismo token
// no abre una segunda conexión.
export function connectSocket(token) {
  if (socket?.connected) return socket
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
  })
  // El cliente reintenta la conexión solo (caída de red, o el backend
  // reiniciándose) — pero cada reconexión abre una sesión nueva en el
  // servidor, que ya no recuerda a qué sala de sucursal pertenecía este
  // socket (las salas vivían en el proceso anterior). Sin esto, después
  // de cualquier corte el cliente se quedaba "conectado" pero fuera de su
  // sala, y dejaba de recibir telemetría/incidentes/anomalías/
  // descubrimiento en vivo hasta que el usuario recargaba la página a
  // mano — `joinSite()` no volvía a mandar 'join:site' porque, desde su
  // propio punto de vista, "ya estaba unido" (currentSiteRoom no cambió).
  socket.on('connect', () => {
    if (currentSiteRoom) socket.emit('join:site', currentSiteRoom)
  })
  return socket
}

export function getSocket() {
  return socket
}

// Un socket solo puede estar "viendo" una sucursal a la vez desde este
// cliente — cambiar de sucursal activa sale de la sala anterior antes de
// entrar a la nueva, para no seguir recibiendo eventos de un lugar que ya
// no se está mirando.
export function joinSite(siteId) {
  if (!socket || !siteId) return
  if (currentSiteRoom === siteId) return
  if (currentSiteRoom) socket.emit('leave:site', currentSiteRoom)
  socket.emit('join:site', siteId)
  currentSiteRoom = siteId
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
    currentSiteRoom = null
  }
}
