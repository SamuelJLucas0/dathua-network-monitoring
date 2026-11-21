<template>
  <div v-if="dashboard.loading && !dashboard.loaded" class="flex items-center justify-center py-24">
    <span class="w-8 h-8 rounded-full border-2 border-dathua-border border-t-dathua-orange animate-spin"></span>
  </div>

  <EmptyState
    v-else-if="dashboard.sites.length === 0"
    size="lg"
    title="Primero crea una sucursal"
    description="El agente se conecta a una sucursal con su llave. Crea tu sucursal y regresa aquí para instalarlo."
  >
    <router-link
      to="/dashboard/sites"
      class="inline-flex px-5 py-2.5 rounded-lg text-sm font-semibold bg-dathua-orange text-white hover:bg-[#B45309] transition-colors duration-200"
    >
      Ir a Sucursales y zonas
    </router-link>
  </EmptyState>

  <div v-else class="space-y-6">
    <!-- Encabezado + estado en vivo del agente de esta sucursal -->
    <div class="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 class="font-heading text-2xl font-bold text-white">Instalar el agente</h1>
        <p class="text-dathua-text-soft text-sm mt-1">
          El agente es un programa pequeño que va en una computadora de
          <span class="text-white">{{ site?.name }}</span> y revisa que tus equipos respondan bien.
        </p>
      </div>
      <div
        class="flex items-center gap-2 text-xs font-medium rounded-full px-3 py-1.5 border"
        :class="agentStatus.classes"
      >
        <span class="w-2 h-2 rounded-full" :class="agentStatus.dot"></span>
        {{ agentStatus.label }}
      </div>
    </div>

    <!-- PASO 1: sistema -->
    <section class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
      <StepTitle n="1" title="¿Qué sistema tiene la computadora donde lo vas a instalar?" />
      <p class="text-dathua-text-soft text-sm mb-4">
        Elige una computadora de la sucursal que esté siempre encendida y conectada a la misma red que tus
        equipos (router, cámaras, terminal de cobro).
      </p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          v-for="opt in OS_OPTIONS"
          :key="opt.id"
          type="button"
          class="text-left rounded-xl border p-4 transition-colors duration-200 cursor-pointer"
          :class="os === opt.id
            ? 'border-dathua-orange bg-dathua-orange/10'
            : 'border-dathua-border hover:border-white/30'"
          @click="os = opt.id"
        >
          <div class="flex items-center gap-3">
            <span class="w-9 h-9 rounded-lg bg-dathua-bg border border-dathua-border flex items-center justify-center shrink-0">
              <svg class="w-5 h-5" :class="os === opt.id ? 'text-dathua-orange' : 'text-dathua-text-soft'" viewBox="0 0 24 24" fill="currentColor">
                <path :d="opt.icon" />
              </svg>
            </span>
            <div class="min-w-0">
              <p class="text-white font-medium text-sm">
                {{ opt.label }}
                <span v-if="opt.id === detectedOs" class="text-[10px] font-semibold uppercase tracking-wide text-dathua-orange ml-1">esta computadora</span>
              </p>
              <p class="text-dathua-text-soft text-xs mt-0.5">{{ opt.hint }}</p>
            </div>
          </div>
        </button>
      </div>
    </section>

    <!-- PASO 2: llave + servidor -->
    <section class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
      <StepTitle n="2" title="Ten a la mano la llave de esta sucursal" />
      <p class="text-dathua-text-soft text-sm mb-4">
        {{ os === 'windows'
          ? 'El instalador te la va a pedir. Es lo que vincula el agente con tu cuenta.'
          : 'Ya va incluida en los comandos del paso 3; no tienes que escribirla.' }}
      </p>

      <label class="block text-xs font-medium text-dathua-text-soft mb-1.5">Llave de sucursal</label>
      <div class="flex items-center gap-2">
        <code class="flex-1 min-w-0 truncate bg-dathua-bg border border-dathua-border rounded-lg px-3 py-2 text-xs text-dathua-orange font-mono">
          {{ apiKey ? (showKey ? apiKey : maskedKey) : (keyError ? '—' : 'Cargando…') }}
        </code>
        <button type="button" :class="SMALL_BTN" :disabled="!apiKey" @click="showKey = !showKey">
          {{ showKey ? 'Ocultar' : 'Mostrar' }}
        </button>
        <button type="button" :class="SMALL_BTN" :disabled="!apiKey" @click="copy('key', apiKey)">
          {{ copied === 'key' ? 'Copiada' : 'Copiar' }}
        </button>
      </div>
      <p v-if="keyError" class="text-xs text-red-400 mt-1.5">{{ keyError }}</p>

      <!-- Mientras no exista servidor de producción, el instalador de
           Windows trae "localhost" de fábrica (DEFAULT_API_BASE_URL en
           dathua-agent/agent/config.py) y hay que escribir la dirección
           real en "Opciones avanzadas". Cuando el default coincida con el
           servidor real, este bloque desaparece solo. -->
      <template v-if="os === 'windows' && needsServerAddress">
        <label class="block text-xs font-medium text-dathua-text-soft mt-4 mb-1.5">Dirección del servidor</label>
        <div class="flex items-center gap-2">
          <code class="flex-1 min-w-0 truncate bg-dathua-bg border border-dathua-border rounded-lg px-3 py-2 text-xs text-white font-mono">{{ agentApiUrl }}</code>
          <button type="button" :class="SMALL_BTN" @click="copy('url', agentApiUrl)">
            {{ copied === 'url' ? 'Copiada' : 'Copiar' }}
          </button>
        </div>
        <p class="text-xs text-dathua-text-soft mt-1.5">
          El instalador la pide en <span class="text-white">"Opciones avanzadas"</span>, debajo de la llave.
        </p>
      </template>
    </section>

    <!-- PASO 3 (Windows) -->
    <section v-if="os === 'windows'" class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
      <StepTitle n="3" title="Descarga e instala DatHua Agent para Windows" />

      <div class="flex items-center gap-4 flex-wrap mb-5">
        <a
          v-if="manifest?.windows"
          :href="`/downloads/${manifest.windows.file}`"
          download
          class="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold bg-dathua-orange text-white hover:bg-[#B45309] transition-colors duration-200"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
          Descargar para Windows
        </a>
        <p v-if="manifest?.windows" class="text-xs text-dathua-text-soft">
          Versión {{ manifest.version }} · {{ formatSize(manifest.windows.sizeBytes) }} · Windows 10 u 11
        </p>
        <p v-else-if="manifestLoaded" class="text-sm text-dathua-text-soft">
          El instalador de Windows todavía no está publicado en este servidor.
        </p>
      </div>

      <ol class="space-y-3">
        <li v-for="(stepText, i) in windowsSteps" :key="i" class="flex gap-3">
          <span class="w-5 h-5 rounded-full bg-dathua-bg border border-dathua-border text-[11px] flex items-center justify-center text-dathua-text-soft shrink-0 mt-0.5">{{ i + 1 }}</span>
          <p class="text-sm text-gray-300" v-html="stepText"></p>
        </li>
      </ol>

      <details class="mt-5 group">
        <summary class="text-sm text-dathua-text-soft hover:text-white cursor-pointer select-none">¿Cómo lo reviso, lo cambio o lo quito después?</summary>
        <ul class="mt-3 space-y-2 text-sm text-gray-300 list-disc pl-5">
          <li>Búscalo en el menú Inicio como <b class="text-white">DatHua Agent</b>: te muestra si está funcionando y cuándo reportó por última vez.</li>
          <li>Para conectarlo a otra sucursal, ábrelo y elige <b class="text-white">Reconfigurar</b>.</li>
          <li>Para quitarlo, ábrelo y elige <b class="text-white">Desinstalar</b> (o desde Configuración → Aplicaciones instaladas). Tu historial en DatHua no se borra.</li>
        </ul>
      </details>
    </section>

    <!-- PASO 3 (Linux) -->
    <section v-else class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
      <StepTitle n="3" title="Copia y pega estos comandos en una terminal" />
      <p class="text-dathua-text-soft text-sm mb-4">
        Descargan el agente en tu carpeta personal, lo configuran con la llave de
        <span class="text-white">{{ site?.name }}</span> y lo dejan funcionando solo, aunque reinicies.
        No necesitan permisos de administrador.
      </p>

      <div class="relative">
        <pre class="bg-dathua-bg border border-dathua-border rounded-xl p-4 pr-24 text-xs text-gray-200 font-mono overflow-x-auto leading-relaxed">{{ linuxCommands(showKey ? apiKey : maskedKey) }}</pre>
        <button
          type="button"
          class="absolute top-3 right-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-dathua-orange text-white hover:bg-[#B45309] transition-colors duration-200 cursor-pointer disabled:opacity-50"
          :disabled="!apiKey"
          @click="copy('linux', linuxCommands(apiKey))"
        >
          {{ copied === 'linux' ? 'Copiado' : 'Copiar' }}
        </button>
      </div>
      <p class="text-xs text-dathua-text-soft mt-2">
        Al copiar se incluye tu llave completa, aunque aquí se vea oculta.
        Se instala en <code class="text-gray-300">~/dathua-agent</code>: no borres esa carpeta, el agente corre desde ahí.
      </p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div>
          <h3 class="text-white text-sm font-semibold mb-2">Necesitas</h3>
          <ul class="text-sm text-gray-300 space-y-1.5 list-disc pl-5">
            <li>Python 3.11 o más nuevo (<code class="text-gray-400">python3 --version</code>)</li>
            <li>Una distribución con systemd (Ubuntu, Debian, Fedora, Arch…)</li>
            <li>Los programas <code class="text-gray-400">ping</code>, <code class="text-gray-400">ip</code> y <code class="text-gray-400">curl</code> (ya vienen en casi todas)</li>
          </ul>
        </div>
        <div>
          <h3 class="text-white text-sm font-semibold mb-2">Descarga manual</h3>
          <p v-if="manifest?.linux" class="text-sm text-gray-300">
            Si prefieres no usar <code class="text-gray-400">curl</code>,
            <a :href="`/downloads/${manifest.linux.file}`" download class="text-dathua-orange hover:underline">
              descarga el paquete ({{ formatSize(manifest.linux.sizeBytes) }})</a>,
            descomprímelo en tu carpeta personal y sigue desde <code class="text-gray-400">cd dathua-agent</code>.
          </p>
          <p v-else-if="manifestLoaded" class="text-sm text-gray-300">
            El paquete de Linux todavía no está publicado en este servidor.
          </p>
        </div>
      </div>

      <details class="mt-6">
        <summary class="text-sm text-dathua-text-soft hover:text-white cursor-pointer select-none">Documentación: comandos útiles</summary>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full text-sm">
            <tbody>
              <tr v-for="row in LINUX_REFERENCE" :key="row.cmd" class="border-t border-dathua-border">
                <td class="py-2 pr-4 text-gray-300 align-top whitespace-nowrap">{{ row.what }}</td>
                <td class="py-2">
                  <div class="flex items-center gap-2">
                    <code class="text-xs text-gray-200 font-mono bg-dathua-bg border border-dathua-border rounded px-2 py-1 whitespace-pre">{{ row.cmd }}</code>
                    <button type="button" :class="SMALL_BTN" @click="copy(row.cmd, row.cmd)">
                      {{ copied === row.cmd ? 'Copiado' : 'Copiar' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      <details class="mt-3">
        <summary class="text-sm text-dathua-text-soft hover:text-white cursor-pointer select-none">Si algo sale mal</summary>
        <dl class="mt-3 space-y-3 text-sm">
          <div v-for="item in LINUX_TROUBLESHOOTING" :key="item.problem">
            <dt class="text-white">{{ item.problem }}</dt>
            <dd class="text-gray-300 mt-0.5" v-html="item.fix"></dd>
          </div>
        </dl>
      </details>
    </section>

    <!-- PASO 4: comprobar -->
    <section class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
      <StepTitle n="4" title="Comprueba que ya está reportando" />
      <div class="flex items-start gap-3">
        <span class="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" :class="agentStatus.dot"></span>
        <div>
          <p class="text-sm text-white">{{ agentStatus.title }}</p>
          <p class="text-sm text-dathua-text-soft mt-0.5">{{ agentStatus.detail }}</p>
          <router-link
            v-if="agentStatus.state === 'online'"
            to="/dashboard/nodes"
            class="inline-block text-sm text-dathua-orange hover:underline mt-2"
          >
            Ver equipos y aprobar los que descubrió →
          </router-link>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
// Página "Instalar agente": todo lo necesario para poner el agente en una
// sucursal (Windows o Linux) sin salir del dashboard. Los archivos los
// publica scripts/build_agent_downloads.py en public/downloads/, junto con
// agents.json (versión y tamaño), que esta vista lee para no mostrar un
// botón de descarga roto si el archivo no existe.
//
// El estado de arriba ("Conectado", "Esperando el primer reporte") sale
// de site.lastTelemetryAt, que el store actualiza en vivo con cada evento
// telemetry:new de Socket.IO — así se ve el momento exacto en que el
// agente recién instalado reporta por primera vez, sin recargar.
import { computed, defineComponent, h, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useDashboardStore } from '../../stores/dashboard'
import { API_BASE_URL, getSiteApiKey } from '../../services/api'
import { copyText } from '../../utils/clipboard'
import { formatRelativeTime } from '../../utils/time'
import EmptyState from '../../components/dashboard/EmptyState.vue'

// Mismo valor que DEFAULT_API_BASE_URL en dathua-agent/agent/config.py:
// lo que el instalador de Windows trae de fábrica.
const AGENT_DEFAULT_API_URL = 'http://localhost:3000/api'
// Mismo umbral que AgentOfflineBanner: el agente reporta cada ~20 s.
const AGENT_SILENCE_THRESHOLD_MS = 3 * 60 * 1000

const SMALL_BTN = 'shrink-0 text-xs font-semibold text-dathua-text-soft border border-dathua-border rounded-lg px-3 py-2 hover:text-white hover:border-white/30 transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

const OS_OPTIONS = [
  {
    id: 'windows',
    label: 'Windows',
    hint: 'Instalador con ventanas, como cualquier programa.',
    icon: 'M3 5.5l7.5-1v7H3v-6zm0 13l7.5 1v-7H3v6zm8.5 1.1L21 21v-8.5h-9.5v7.1zm0-15.2v7.1H21V3l-9.5 1.4z',
  },
  {
    id: 'linux',
    label: 'Linux',
    hint: 'Se instala copiando unos comandos en la terminal.',
    icon: 'M12 2c-2.2 0-3.6 1.9-3.6 4.6 0 1.2.3 2.2.1 3.2-.3 1.6-2.6 3.4-3.2 6.1-.3 1.2.1 2.2.9 2.6.4.2.6.6.7 1.1.3 1.3 1.7 1.6 3 1.1.9-.3 1.4-.3 2.2-.3h1.8c.8 0 1.3 0 2.2.3 1.3.5 2.7.2 3-1.1.1-.5.3-.9.7-1.1.8-.4 1.2-1.4.9-2.6-.6-2.7-2.9-4.5-3.2-6.1-.2-1 .1-2 .1-3.2C15.6 3.9 14.2 2 12 2zm-1.5 4a.9.9 0 110 1.8.9.9 0 010-1.8zm3 0a.9.9 0 110 1.8.9.9 0 010-1.8z',
  },
]

const LINUX_REFERENCE = [
  { what: 'Ver si está funcionando', cmd: '~/dathua-agent/.venv/bin/python -m agent_linux status' },
  { what: 'Ver qué está haciendo (en vivo)', cmd: 'journalctl --user -u dathua-agent.service -f' },
  { what: 'Reiniciarlo', cmd: 'systemctl --user restart dathua-agent.service' },
  { what: 'Conectarlo a otra sucursal', cmd: 'cd ~/dathua-agent && .venv/bin/python -m agent_linux setup' },
  { what: 'Quitarlo por completo', cmd: '~/dathua-agent/.venv/bin/python -m agent_linux uninstall --purge && rm -rf ~/dathua-agent' },
]

const LINUX_TROUBLESHOOTING = [
  {
    problem: '"python3 -m venv" dice que falta ensurepip o venv',
    fix: 'En Ubuntu o Debian instálalo con <code class="text-gray-400">sudo apt install python3-venv</code> y vuelve a pegar los comandos.',
  },
  {
    problem: 'Dice que no pudo activar "linger"',
    fix: 'El agente se detendría al cerrar tu sesión. Pide a quien administre la computadora que corra <code class="text-gray-400">sudo loginctl enable-linger TU_USUARIO</code>.',
  },
  {
    problem: '"Esa llave no es válida o fue revocada"',
    fix: 'La sucursal se borró o la llave se copió incompleta. Vuelve a copiar los comandos desde esta página.',
  },
  {
    problem: '"No se pudo contactar la API"',
    fix: 'Esa computadora no alcanza el servidor de DatHua. Revisa que tenga internet (o que esté en la misma red que el servidor, en pruebas).',
  },
  {
    problem: 'Quiero actualizar el agente',
    fix: 'Pega otra vez el bloque de comandos de arriba; reemplaza los archivos y vuelve a arrancarlo con tu misma configuración.',
  },
]

// Título numerado de cada paso — componente local para no repetir el
// mismo marcado cuatro veces.
const StepTitle = defineComponent({
  props: { n: String, title: String },
  setup: (p) => () => h('div', { class: 'flex items-center gap-3 mb-2' }, [
    h('span', { class: 'w-6 h-6 rounded-full bg-dathua-orange/15 border border-dathua-orange/40 text-dathua-orange text-xs font-semibold flex items-center justify-center shrink-0' }, p.n),
    h('h2', { class: 'text-white font-semibold' }, p.title),
  ]),
})

const auth = useAuthStore()
const dashboard = useDashboardStore()
const site = computed(() => dashboard.activeSite)

function detectOs() {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('windows')) return 'windows'
  if (ua.includes('linux') && !ua.includes('android')) return 'linux'
  return null
}
const detectedOs = detectOs()
const os = ref(detectedOs || 'windows')

// --- Llave de la sucursal activa -----------------------------------------
const apiKey = ref('')
const keyError = ref('')
const showKey = ref(false)
const maskedKey = computed(() => (apiKey.value ? `${apiKey.value.slice(0, 9)}${'•'.repeat(24)}` : 'dth_site_••••••••'))

async function loadKey(siteId) {
  apiKey.value = ''
  keyError.value = ''
  showKey.value = false
  if (!siteId) return
  try {
    apiKey.value = await getSiteApiKey(auth.token, siteId)
  } catch (e) {
    keyError.value = e.message
  }
}
watch(() => dashboard.activeSiteId, loadKey, { immediate: true })

// --- Dirección del servidor que debe usar el agente -----------------------
// Absoluta (el agente corre en otra máquina). Si el dashboard se configuró
// con "localhost" pero se está abriendo desde otra máquina por IP, para el
// agente "localhost" sería su propia computadora: se usa la IP con la que
// se abrió el dashboard.
const agentApiUrl = computed(() => {
  const url = new URL(API_BASE_URL, window.location.origin)
  const local = ['localhost', '127.0.0.1']
  if (local.includes(url.hostname) && !local.includes(window.location.hostname)) {
    url.hostname = window.location.hostname
  }
  return url.toString().replace(/\/$/, '')
})
const needsServerAddress = computed(() => agentApiUrl.value !== AGENT_DEFAULT_API_URL)

// De dónde descarga el paquete la otra computadora (curl). Mismo problema
// que arriba: si este panel se abrió como localhost, "localhost" en la
// computadora Linux sería ella misma. En ese caso se asume que el panel
// corre en la misma máquina que la API (así es en el servidor de
// desarrollo) y se usa su dirección con el puerto del panel.
const downloadsOrigin = computed(() => {
  const local = ['localhost', '127.0.0.1']
  if (!local.includes(window.location.hostname)) return window.location.origin
  const apiHost = new URL(agentApiUrl.value).hostname
  if (local.includes(apiHost)) return window.location.origin
  const port = window.location.port ? `:${window.location.port}` : ''
  return `${window.location.protocol}//${apiHost}${port}`
})

function linuxCommands(key) {
  return [
    'cd ~',
    `curl -fLO ${downloadsOrigin.value}/downloads/dathua-agent-linux.tar.gz`,
    'tar -xzf dathua-agent-linux.tar.gz && cd dathua-agent',
    'python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt',
    `.venv/bin/python -m agent_linux setup --url ${agentApiUrl.value} --key ${key} --install`,
  ].join('\n')
}

const windowsSteps = computed(() => [
  'Abre el archivo descargado. Si Windows muestra <b class="text-white">"Windows protegió su PC"</b>, da clic en <b class="text-white">Más información</b> y luego en <b class="text-white">Ejecutar de todas formas</b>.',
  needsServerAddress.value
    ? 'Sigue el asistente. Cuando te pida la llave, pégala; abre <b class="text-white">"Opciones avanzadas"</b> y pega la dirección del servidor del paso 2.'
    : 'Sigue el asistente y, cuando te pida la llave, pega la del paso 2.',
  'Cuando Windows pregunte si quieres permitir cambios, elige <b class="text-white">Sí</b>. Listo: queda funcionando aunque cierres sesión o reinicies.',
])

// --- Archivos publicados ---------------------------------------------------
const manifest = ref(null)
const manifestLoaded = ref(false)

async function loadManifest() {
  try {
    const res = await fetch('/downloads/agents.json', { cache: 'no-store' })
    manifest.value = res.ok ? await res.json() : null
  } catch {
    manifest.value = null
  } finally {
    manifestLoaded.value = true
  }
}

function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

// --- Copiar ----------------------------------------------------------------
const copied = ref('')
async function copy(id, text) {
  try {
    await copyText(text)
    copied.value = id
    setTimeout(() => {
      if (copied.value === id) copied.value = ''
    }, 1500)
  } catch {
    keyError.value = 'No se pudo copiar automáticamente — selecciónalo a mano.'
  }
}

// --- Estado del agente en vivo --------------------------------------------
const nowTick = ref(Date.now())
let nowTimer = null

const agentStatus = computed(() => {
  const last = site.value?.lastTelemetryAt
  if (!last) {
    return {
      state: 'waiting',
      label: 'Esperando al agente',
      title: 'Todavía no recibimos nada de esta sucursal.',
      detail: 'En cuanto termines la instalación, esto cambia solo (no hace falta recargar). Suele tardar menos de un minuto.',
      dot: 'bg-dathua-orange animate-pulse',
      classes: 'text-dathua-orange bg-dathua-orange/10 border-dathua-orange/30',
    }
  }
  const silentMs = nowTick.value - new Date(last).getTime()
  if (silentMs > AGENT_SILENCE_THRESHOLD_MS) {
    return {
      state: 'silent',
      label: 'El agente dejó de reportar',
      title: `El último reporte llegó ${formatRelativeTime(last)}.`,
      detail: 'Revisa que la computadora del agente esté encendida y con internet. Si lo acabas de reinstalar, espera un minuto.',
      dot: 'bg-red-400',
      classes: 'text-red-300 bg-red-500/10 border-red-400/30',
    }
  }
  return {
    state: 'online',
    label: 'Agente conectado',
    title: '¡Listo! El agente ya está reportando.',
    detail: `Último reporte ${formatRelativeTime(last)}. En unos minutos aparecerán los equipos que encontró en tu red.`,
    dot: 'bg-emerald-400',
    classes: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/30',
  }
})

onMounted(() => {
  loadManifest()
  nowTimer = setInterval(() => (nowTick.value = Date.now()), 10000)
})
onUnmounted(() => {
  if (nowTimer) clearInterval(nowTimer)
})
</script>
