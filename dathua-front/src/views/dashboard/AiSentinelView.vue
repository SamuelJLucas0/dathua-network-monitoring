<template>
  <div v-if="dashboard.loading && !dashboard.loaded" class="flex items-center justify-center py-24">
    <span class="w-8 h-8 rounded-full border-2 border-dathua-border border-t-dathua-orange animate-spin"></span>
  </div>

  <OnboardingEmptyState v-else-if="dashboard.sites.length === 0" @create="showCreateSite = true" />

  <div v-else class="space-y-6">
    <AgentOfflineBanner :site="dashboard.activeSite" :is-monitored="activeSiteIsMonitored" />
    <NotMonitoredNotice
      v-if="!activeSiteIsMonitored"
      :site="dashboard.activeSite"
      :has-nodes="dashboard.activeSiteNodes.length > 0"
    />

    <div class="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 class="font-heading text-2xl font-bold text-white">IA Sentinel</h1>
        <p class="text-dathua-text-soft text-sm mt-1">
          Anomalías detectadas por IA en <span class="text-white">{{ dashboard.activeSite?.name }}</span>.
        </p>
      </div>
      <button
        type="button"
        :disabled="analyzing"
        class="px-4 py-2.5 rounded-lg text-sm font-semibold bg-dathua-orange text-white hover:bg-[#B45309] transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        @click="runAnalysis"
      >
        {{ analyzing ? 'Analizando…' : 'Forzar re-análisis' }}
      </button>
    </div>

    <p v-if="analysisMessage" class="text-xs rounded-lg px-3 py-2" :class="analysisError ? 'text-red-400 bg-red-500/10 border border-red-400/30' : 'text-dathua-text-soft bg-white/5 border border-dathua-border'">
      {{ analysisMessage }}
    </p>

    <!-- Resumen -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <StatTile label="Total" :value="stats?.total ?? '—'" tone="brand">
        <template #icon>
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
        </template>
      </StatTile>
      <StatTile label="Por revisar" :value="stats?.pendingReview ?? '—'" :tone="Number(stats?.pendingReview) > 0 ? 'warning' : 'good'">
        <template #icon>
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
        </template>
      </StatTile>
      <StatTile label="Revisadas" :value="stats?.reviewed ?? '—'" tone="good">
        <template #icon>
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
        </template>
      </StatTile>
      <StatTile label="Falsos positivos" :value="stats?.falsePositives ?? '—'" tone="neutral">
        <template #icon>
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </template>
      </StatTile>
    </div>

    <!-- Filtros -->
    <div class="flex flex-col sm:flex-row gap-2">
      <select v-model="classificationFilter" class="bg-dathua-bg border border-dathua-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-dathua-orange">
        <option value="">Todas las clasificaciones</option>
        <option v-for="c in CLASSIFICATIONS" :key="c" :value="c">{{ SEVERITY[c].label }}</option>
      </select>
      <select v-model="reviewedFilter" class="bg-dathua-bg border border-dathua-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-dathua-orange">
        <option value="">Todas</option>
        <option value="false">Por revisar</option>
        <option value="true">Revisadas</option>
      </select>
      <span v-if="loading" class="w-4 h-4 rounded-full border-2 border-dathua-border border-t-dathua-orange animate-spin self-center"></span>
    </div>

    <!-- Acciones en lote — actúan sobre exactamente lo que está filtrado
         y visible en la lista de abajo, no sobre todo el historial de la
         sucursal de un jalón. -->
    <div v-if="visibleAnomalies.length > 0" class="flex items-center justify-end gap-4">
      <button
        v-if="hasPendingInList"
        type="button"
        class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 cursor-pointer"
        @click="confirmingBulkReview = true"
      >
        Marcar todo como revisado
      </button>
      <button
        type="button"
        class="text-xs font-semibold text-dathua-text-soft hover:text-red-400 transition-colors duration-200 cursor-pointer"
        @click="confirmingBulkDelete = true"
      >
        Eliminar todo
      </button>
    </div>

    <!-- Lista -->
    <div class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
      <EmptyState
        v-if="visibleAnomalies.length === 0 && hasActiveFilters"
        icon="filter"
        title="Sin anomalías con estos filtros"
      >
        <button
          type="button"
          class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 cursor-pointer"
          @click="classificationFilter = ''; reviewedFilter = ''"
        >
          Limpiar filtros
        </button>
      </EmptyState>
      <EmptyState
        v-else-if="visibleAnomalies.length === 0"
        icon="ai"
        title="Sin anomalías relevantes"
        description="La IA analiza la telemetría de esta sucursal y avisa aquí en cuanto note algo con score mayor a 70%."
      />
      <ul v-else class="divide-y divide-dathua-border">
        <li v-for="anomaly in visibleAnomalies" :key="anomaly._id" class="py-4 first:pt-0 last:pb-0">
          <!-- Escritorio/tablet (>=640px): fila completa, sin cambios. -->
          <div class="hidden sm:flex items-start gap-3">
            <SeverityBadge :severity="anomaly.classification" class="shrink-0 mt-0.5" />
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-3">
                <p class="text-sm text-white font-medium">
                  {{ formatMetricName(anomaly.metricAnalyzed) }} en
                  <router-link
                    :to="{ path: `/dashboard/nodes/${anomaly.metadata.node_id}`, query: highlightQuery(anomaly) }"
                    class="hover:text-dathua-orange transition-colors duration-200"
                  >
                    {{ nodeNameFor(anomaly.metadata.node_id) }}
                  </router-link>
                </p>
                <span class="text-xs text-dathua-text-soft/70 shrink-0">{{ formatRelativeTime(anomaly.timestamp) }}</span>
              </div>
              <!-- Explicación en español simple (qué significa, causas
                   probables, qué hacer) — antes esta tarjeta solo mostraba
                   el valor crudo y un "Score: 81%" sin ningún contexto. Si
                   la métrica es una que el motor de IA todavía no
                   documenta aquí, se cae a una frase genérica honesta en
                   vez de dejar la tarjeta en blanco. -->
              <AnomalyExplanation :metric-analyzed="anomaly.metricAnalyzed" :severity="anomaly.classification" />
              <p v-if="!getExplanation(anomaly.metricAnalyzed, anomaly.classification)" class="text-xs text-gray-300 mt-1">
                Se detectó un comportamiento fuera de lo normal en esta métrica.
              </p>
              <p class="text-[11px] text-dathua-text-soft/60 mt-1.5">
                Valor detectado: {{ anomaly.observed_value }}{{ anomaly.expected_Baseline !== null ? ` · normal para este equipo: ~${anomaly.expected_Baseline}` : '' }}
              </p>
              <p v-if="ipFor(anomaly.metadata.node_id)" class="text-xs text-dathua-text-soft/70 mt-0.5">{{ ipFor(anomaly.metadata.node_id) }}</p>
            </div>
            <div class="shrink-0 flex flex-col items-end gap-1.5">
              <span v-if="anomaly.is_false_positive" class="text-xs text-dathua-text-soft">Marcada como falso positivo</span>
              <span v-else-if="anomaly.reviewed" class="text-xs" :style="{ color: ROLE_COLOR.good }">Revisada, es real</span>
              <div v-else class="flex items-center gap-2">
                <button
                  type="button"
                  :disabled="reviewingId === anomaly._id"
                  class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 cursor-pointer disabled:opacity-50"
                  @click="review(anomaly, false)"
                >
                  Es real
                </button>
                <button
                  type="button"
                  :disabled="reviewingId === anomaly._id"
                  class="text-xs font-semibold text-dathua-text-soft hover:text-white transition-colors duration-200 cursor-pointer disabled:opacity-50"
                  @click="review(anomaly, true)"
                >
                  Falso positivo
                </button>
              </div>
              <button
                type="button"
                :disabled="reviewingId === anomaly._id"
                title="Eliminar"
                class="w-7 h-7 rounded-lg flex items-center justify-center text-dathua-text-soft hover:text-red-400 hover:bg-red-500/10 transition-colors duration-200 cursor-pointer disabled:opacity-50"
                @click="confirmingAnomaly = anomaly"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Móvil (<640px): tarjeta compacta — solo lo esencial a simple
               vista. Antes se intentaba meter la misma fila de 3 columnas
               de escritorio en una pantalla angosta y el texto se
               encimaba (fecha/estado sobre los botones). Ahora todo lo
               demás (explicación, causas, valor/línea base, IP, acciones)
               vive junto en un solo panel que se abre con el botón "›". -->
          <button
            type="button"
            class="sm:hidden w-full flex items-start gap-3 text-left cursor-pointer"
            @click="mobileAnomaly = anomaly"
          >
            <SeverityBadge :severity="anomaly.classification" class="shrink-0 mt-0.5" />
            <div class="min-w-0 flex-1">
              <p class="text-sm text-white font-medium leading-snug">
                {{ formatMetricName(anomaly.metricAnalyzed) }} en {{ nodeNameFor(anomaly.metadata.node_id) }}
              </p>
              <p class="text-xs text-dathua-text-soft/70 mt-0.5">{{ formatRelativeTime(anomaly.timestamp) }}</p>
              <span
                class="inline-block text-[11px] font-medium mt-1"
                :class="anomaly.is_false_positive || anomaly.reviewed ? '' : 'text-dathua-orange'"
                :style="anomaly.reviewed && !anomaly.is_false_positive ? { color: ROLE_COLOR.good } : {}"
              >
                <template v-if="anomaly.is_false_positive">Marcada como falso positivo</template>
                <template v-else-if="anomaly.reviewed">Revisada, es real</template>
                <template v-else>Por revisar</template>
              </span>
            </div>
            <svg class="w-4 h-4 text-dathua-text-soft/60 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </li>
      </ul>
    </div>
  </div>

  <!-- Panel móvil de detalle: junta TODO lo de la tarjeta (explicación,
       causas/sugerencia, valor/línea base, IP, acciones) en un solo lugar,
       en vez de que el usuario tenga que abrir varias cosas sueltas. -->
  <Teleport to="body">
    <div
      v-if="mobileAnomaly"
      class="sm:hidden fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm"
      @click.self="mobileAnomaly = null"
    >
      <div class="w-full max-h-[85vh] overflow-y-auto bg-dathua-card border-t border-dathua-border rounded-t-2xl p-5 pb-6 shadow-2xl">
        <div class="w-10 h-1 rounded-full bg-dathua-border mx-auto mb-4"></div>

        <div class="flex items-start gap-3">
          <SeverityBadge :severity="mobileAnomaly.classification" class="shrink-0 mt-0.5" />
          <div class="min-w-0 flex-1">
            <p class="text-sm text-white font-semibold leading-snug">
              {{ formatMetricName(mobileAnomaly.metricAnalyzed) }} en
              <router-link
                :to="{ path: `/dashboard/nodes/${mobileAnomaly.metadata.node_id}`, query: highlightQuery(mobileAnomaly) }"
                class="text-dathua-orange hover:text-white transition-colors duration-200"
                @click="mobileAnomaly = null"
              >
                {{ nodeNameFor(mobileAnomaly.metadata.node_id) }}
              </router-link>
            </p>
            <p class="text-xs text-dathua-text-soft/70 mt-0.5">
              {{ formatRelativeTime(mobileAnomaly.timestamp) }}<span v-if="ipFor(mobileAnomaly.metadata.node_id)"> · {{ ipFor(mobileAnomaly.metadata.node_id) }}</span>
            </p>
          </div>
        </div>

        <p class="text-xs text-gray-300 mt-3">
          {{ mobileExplanation?.what || 'Se detectó un comportamiento fuera de lo normal en esta métrica.' }}
        </p>
        <p v-if="mobileExplanation?.urgency" class="text-xs text-dathua-text-soft mt-1">{{ mobileExplanation.urgency }}</p>

        <div v-if="mobileExplanation" class="mt-3 bg-white/5 border border-dathua-border rounded-lg px-3 py-2.5 space-y-2">
          <div>
            <p class="text-[11px] font-semibold text-dathua-text-soft uppercase tracking-wide">Causas probables</p>
            <ul class="text-xs text-gray-300 list-disc list-inside space-y-0.5 mt-1">
              <li v-for="(cause, i) in mobileExplanation.causes" :key="i">{{ cause }}</li>
            </ul>
          </div>
          <p class="text-xs text-gray-300">
            <span class="font-semibold text-white">Qué hacer: </span>{{ mobileExplanation.suggestion }}
          </p>
        </div>

        <p class="text-[11px] text-dathua-text-soft/60 mt-3">
          Valor detectado: {{ mobileAnomaly.observed_value }}{{ mobileAnomaly.expected_Baseline !== null ? ` · normal para este equipo: ~${mobileAnomaly.expected_Baseline}` : '' }}
        </p>

        <div class="mt-4 pt-4 border-t border-dathua-border flex items-center justify-between gap-3">
          <span v-if="mobileAnomaly.is_false_positive" class="text-xs text-dathua-text-soft">Marcada como falso positivo</span>
          <span v-else-if="mobileAnomaly.reviewed" class="text-xs font-medium" :style="{ color: ROLE_COLOR.good }">Revisada, es real</span>
          <div v-else class="flex items-center gap-3">
            <button
              type="button"
              :disabled="reviewingId === mobileAnomaly._id"
              class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 cursor-pointer disabled:opacity-50"
              @click="review(mobileAnomaly, false)"
            >
              Es real
            </button>
            <button
              type="button"
              :disabled="reviewingId === mobileAnomaly._id"
              class="text-xs font-semibold text-dathua-text-soft hover:text-white transition-colors duration-200 cursor-pointer disabled:opacity-50"
              @click="review(mobileAnomaly, true)"
            >
              Falso positivo
            </button>
          </div>
          <button
            type="button"
            title="Eliminar"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-dathua-text-soft hover:text-red-400 hover:bg-red-500/10 transition-colors duration-200 cursor-pointer shrink-0"
            @click="confirmingAnomaly = mobileAnomaly; mobileAnomaly = null"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          class="w-full mt-4 py-2.5 rounded-lg text-sm font-semibold text-dathua-text-soft border border-dathua-border hover:text-white hover:border-white/30 transition-colors duration-200 cursor-pointer"
          @click="mobileAnomaly = null"
        >
          Cerrar
        </button>
      </div>
    </div>
  </Teleport>

  <CreateSiteModal v-if="showCreateSite" @close="showCreateSite = false" @created="showCreateSite = false" />
  <ConfirmDialog
    v-if="confirmingAnomaly"
    title="Eliminar anomalía"
    message="Esta anomalía se eliminará del historial de IA. Esta acción no se puede deshacer."
    :loading="reviewingId === confirmingAnomaly._id"
    @cancel="confirmingAnomaly = null"
    @confirm="remove(confirmingAnomaly)"
  />
  <ConfirmDialog
    v-if="confirmingBulkReview"
    title="Marcar todo como revisado"
    tone="warning"
    confirm-label="Marcar como revisado"
    :message="`Se marcarán como revisadas (Es real) las ${pendingInListCount} anomalía(s) por revisar que coinciden con los filtros actuales.`"
    :loading="bulkBusy"
    @cancel="confirmingBulkReview = false"
    @confirm="bulkReviewAll"
  />
  <ConfirmDialog
    v-if="confirmingBulkDelete"
    title="Eliminar todo"
    confirm-label="Eliminar todo"
    :message="`Se eliminarán las ${visibleAnomalies.length} anomalía(s) que coinciden con los filtros actuales. Esta acción no se puede deshacer.`"
    :loading="bulkBusy"
    @cancel="confirmingBulkDelete = false"
    @confirm="bulkDeleteAll"
  />
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useDashboardStore } from '../../stores/dashboard'
import * as api from '../../services/api'
import { SEVERITY, ROLE_COLOR } from '../../utils/status'
import { formatMetricName } from '../../utils/metrics'
import { formatRelativeTime } from '../../utils/time'
import { getExplanation } from '../../utils/incidentExplanations'
import { ANOMALY_MIN_SCORE } from '../../utils/anomalies'
import OnboardingEmptyState from '../../components/dashboard/OnboardingEmptyState.vue'
import CreateSiteModal from '../../components/dashboard/CreateSiteModal.vue'
import StatTile from '../../components/dashboard/StatTile.vue'
import SeverityBadge from '../../components/dashboard/SeverityBadge.vue'
import AnomalyExplanation from '../../components/dashboard/AnomalyExplanation.vue'
import ConfirmDialog from '../../components/dashboard/ConfirmDialog.vue'
import AgentOfflineBanner from '../../components/dashboard/AgentOfflineBanner.vue'
import NotMonitoredNotice from '../../components/dashboard/NotMonitoredNotice.vue'
import EmptyState from '../../components/dashboard/EmptyState.vue'

const CLASSIFICATIONS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']

// Umbral compartido con el Resumen y el detalle de equipo (ver
// utils/anomalies.js) — antes cada pantalla tenía su propio 0.7 local, y el
// Resumen ni siquiera lo mandaba, así que "Anomalías por revisar" decía un
// número distinto en cada pantalla para el mismo concepto.
const MIN_SCORE = ANOMALY_MIN_SCORE

const auth = useAuthStore()
const dashboard = useDashboardStore()

// "Monitoreada" = al menos un nodo ya reportó telemetría real alguna vez
// — usado por AgentOfflineBanner para no avisar "dejó de reportar" en una
// sucursal que nunca reportó nada.
const activeSiteIsMonitored = computed(() => {
  if (!dashboard.activeSite) return false
  return dashboard.activeSiteNodes.length > 0 && dashboard.activeSiteNodes.some((n) => n.status !== 'Unknown')
})

const showCreateSite = ref(false)
const classificationFilter = ref('')
const reviewedFilter = ref('')
const loading = ref(false)
const analyzing = ref(false)
const confirmingAnomaly = ref(null)
const confirmingBulkReview = ref(false)
const confirmingBulkDelete = ref(false)
const bulkBusy = ref(false)
const analysisMessage = ref('')
const analysisError = ref(false)
const reviewingId = ref(null)
const stats = ref(null)
const anomalies = ref([])

// Anomalía actualmente abierta en el panel de detalle móvil (ver Teleport
// al final del template) — null cuando está cerrado.
const mobileAnomaly = ref(null)
const mobileExplanation = computed(() =>
  mobileAnomaly.value ? getExplanation(mobileAnomaly.value.metricAnalyzed, mobileAnomaly.value.classification) : null
)

// El filtro de score bajo ahora lo aplica el backend (mismo `minScore` en
// getAnomalies y getAnomalyStats, ver load()) — así "Total"/"Por revisar"
// de arriba siempre cuentan justo lo mismo que aparece aquí abajo, en vez
// de que las tarjetas mostraran el total sin filtrar mientras la lista
// escondía las de score bajo como ruido (el número decía "5", la lista
// mostraba 2).
const visibleAnomalies = computed(() => anomalies.value)

// Cuenta las anomalías por revisar que ya están cargadas en pantalla
// (mismos filtros que el listado) — decide si mostrar "Marcar todo como
// revisado" y cuántas afecta, sin tener que volver a preguntarle al backend.
const pendingInListCount = computed(() => anomalies.value.filter((a) => !a.reviewed).length)
const hasPendingInList = computed(() => pendingInListCount.value > 0)
const hasActiveFilters = computed(() => Boolean(classificationFilter.value || reviewedFilter.value))

function nodeNameFor(nodeId) {
  return dashboard.activeSiteNodes.find((n) => n.nodeId === nodeId)?.name || 'un equipo'
}

// `anomaly.metadata.target` lo reescribe el pipeline de IA con una etiqueta
// interna sintética (ej. "node_15", no la IP real) — mejor mostrar la IP
// real del equipo desde la caché del dashboard, y nada si no está.
function ipFor(nodeId) {
  return dashboard.activeSiteNodes.find((n) => n.nodeId === nodeId)?.ipAddress || ''
}

// Va en el link "Ver equipo" — le manda al detalle del equipo la hora
// exacta de la anomalía para que dibuje un pico + etiqueta en su gráfica
// (ver `highlight`/`latencyMarkers`/`lossMarkers` en NodeDetailView.vue).
function highlightQuery(anomaly) {
  const role = SEVERITY[anomaly.classification]?.role
  return {
    hlAt: anomaly.timestamp,
    hlLabel: `${formatMetricName(anomaly.metricAnalyzed)} (IA)`,
    hlMetric: anomaly.metricAnalyzed,
    hlColor: role ? ROLE_COLOR[role] : ROLE_COLOR.critical,
  }
}

async function load() {
  if (!dashboard.activeSiteId) return
  loading.value = true
  try {
    const params = { siteId: dashboard.activeSiteId, minScore: MIN_SCORE, limit: 100 }
    if (classificationFilter.value) params.classification = classificationFilter.value
    if (reviewedFilter.value) params.reviewed = reviewedFilter.value

    const [statsRes, anomaliesRes] = await Promise.all([
      api.getAnomalyStats(auth.token, { siteId: dashboard.activeSiteId, minScore: MIN_SCORE }),
      api.getAnomalies(auth.token, params),
    ])
    stats.value = statsRes
    anomalies.value = anomaliesRes
  } finally {
    loading.value = false
  }
}

async function review(anomaly, isFalsePositive) {
  reviewingId.value = anomaly._id
  try {
    await api.reviewAnomaly(auth.token, anomaly._id, { is_false_positive: isFalsePositive })
    anomaly.reviewed = true
    anomaly.is_false_positive = isFalsePositive
    const statsRes = await api.getAnomalyStats(auth.token, { siteId: dashboard.activeSiteId, minScore: MIN_SCORE })
    stats.value = statsRes
  } finally {
    reviewingId.value = null
  }
}

async function remove(anomaly) {
  reviewingId.value = anomaly._id
  try {
    await api.deleteAnomaly(auth.token, anomaly._id)
    anomalies.value = anomalies.value.filter((a) => a._id !== anomaly._id)
    confirmingAnomaly.value = null
    stats.value = await api.getAnomalyStats(auth.token, { siteId: dashboard.activeSiteId, minScore: MIN_SCORE })
  } finally {
    reviewingId.value = null
  }
}

// Mismos filtros que ya usa `load()` (sin limit) — así "todo" quiere decir
// exactamente lo que el usuario ya está viendo filtrado en pantalla.
function currentFilterParams() {
  const params = { siteId: dashboard.activeSiteId, minScore: MIN_SCORE }
  if (classificationFilter.value) params.classification = classificationFilter.value
  if (reviewedFilter.value) params.reviewed = reviewedFilter.value
  return params
}

async function bulkReviewAll() {
  bulkBusy.value = true
  try {
    await api.bulkReviewAnomalies(auth.token, currentFilterParams())
    confirmingBulkReview.value = false
    await load()
  } finally {
    bulkBusy.value = false
  }
}

async function bulkDeleteAll() {
  bulkBusy.value = true
  try {
    await api.bulkDeleteAnomalies(auth.token, currentFilterParams())
    confirmingBulkDelete.value = false
    await load()
  } finally {
    bulkBusy.value = false
  }
}

async function runAnalysis() {
  analyzing.value = true
  analysisMessage.value = ''
  analysisError.value = false
  try {
    const result = await api.triggerAiAnalysis(auth.token, { hoursBack: 24, siteId: dashboard.activeSiteId })
    if (result.total_metrics === 0 || result.total_metrics_evaluated === 0) {
      analysisMessage.value = result.message || 'No hay métricas suficientes en las últimas 24h para analizar.'
    } else {
      const found = result.anomalies?.length ?? 0
      analysisMessage.value = `Análisis completo: ${result.total_metrics_evaluated} métricas evaluadas, ${found} anomalía(s) nueva(s) detectada(s).`
      await load()
    }
  } catch (e) {
    analysisError.value = true
    analysisMessage.value = e.message
  } finally {
    analyzing.value = false
  }
}

watch([classificationFilter, reviewedFilter, () => dashboard.activeSiteId, () => dashboard.anomalyTick], load)
onMounted(load)
</script>
