<template>
  <div class="space-y-6 max-w-2xl">
    <div>
      <h1 class="font-heading text-2xl font-bold text-white">Mi perfil</h1>
      <p class="text-dathua-text-soft text-sm mt-1">Configuración de tu cuenta y tus notificaciones.</p>
    </div>

    <div class="flex items-center gap-1 border-b border-dathua-border">
      <button
        type="button"
        class="px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors duration-200 cursor-pointer"
        :class="tab === 'account' ? 'text-white border-dathua-orange' : 'text-dathua-text-soft border-transparent hover:text-white'"
        @click="tab = 'account'"
      >
        Cuenta
      </button>
      <button
        type="button"
        class="px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors duration-200 cursor-pointer"
        :class="tab === 'notifications' ? 'text-white border-dathua-orange' : 'text-dathua-text-soft border-transparent hover:text-white'"
        @click="tab = 'notifications'"
      >
        Notificaciones
      </button>
    </div>

    <!-- ====================== CUENTA ====================== -->
    <template v-if="tab === 'account'">
      <form class="bg-dathua-card border border-dathua-border rounded-2xl p-6 space-y-4" @submit.prevent="saveProfile">
        <div>
          <h2 class="text-white font-semibold">Datos básicos</h2>
          <p class="text-dathua-text-soft text-xs mt-0.5">
            {{ me?.orgName }} · Plan {{ me?.plan === 'PRO' ? 'Pro' : 'Básico' }}
          </p>
        </div>
        <TextField v-model="profileForm.name" label="Nombre" required />
        <TextField v-model="profileForm.email" label="Correo" type="email" required />
        <p v-if="profileError" class="text-xs text-red-400 bg-red-500/10 border border-red-400/30 rounded-lg px-3 py-2">{{ profileError }}</p>
        <p v-if="profileSaved" class="text-xs text-white bg-white/5 border border-dathua-border rounded-lg px-3 py-2">Perfil actualizado.</p>
        <button
          type="submit"
          :disabled="savingProfile"
          class="px-4 py-2.5 rounded-lg text-sm font-semibold bg-dathua-orange text-white hover:bg-[#B45309] transition-colors duration-200 cursor-pointer disabled:opacity-50"
        >
          {{ savingProfile ? 'Guardando…' : 'Guardar cambios' }}
        </button>
      </form>

      <form class="bg-dathua-card border border-dathua-border rounded-2xl p-6 space-y-4" @submit.prevent="savePassword">
        <div>
          <h2 class="text-white font-semibold">Contraseña</h2>
          <p class="text-dathua-text-soft text-xs mt-0.5">Al menos 8 caracteres.</p>
        </div>
        <TextField v-model="passwordForm.currentPassword" label="Contraseña actual" type="password" required autocomplete="current-password" />
        <TextField v-model="passwordForm.newPassword" label="Nueva contraseña" type="password" required autocomplete="new-password" />
        <TextField v-model="passwordForm.confirmPassword" label="Confirmar nueva contraseña" type="password" required autocomplete="new-password" />
        <p v-if="passwordError" class="text-xs text-red-400 bg-red-500/10 border border-red-400/30 rounded-lg px-3 py-2">{{ passwordError }}</p>
        <p v-if="passwordSaved" class="text-xs text-white bg-white/5 border border-dathua-border rounded-lg px-3 py-2">Contraseña actualizada.</p>
        <button
          type="submit"
          :disabled="savingPassword"
          class="px-4 py-2.5 rounded-lg text-sm font-semibold text-dathua-text-soft border border-dathua-border hover:text-white hover:border-white/30 transition-colors duration-200 cursor-pointer disabled:opacity-50"
        >
          {{ savingPassword ? 'Actualizando…' : 'Actualizar contraseña' }}
        </button>
      </form>
    </template>

    <!-- ==================== NOTIFICACIONES ==================== -->
    <template v-else>
      <div class="bg-dathua-card border border-dathua-border rounded-2xl p-6 space-y-1">
        <h2 class="text-white font-semibold mb-1">¿Cuándo quieres que te notifiquemos?</h2>
        <p class="text-dathua-text-soft text-xs mb-5">
          Se notifica cuando se crea un incidente (manual o detectado por IA). Elige qué severidades te interesan.
        </p>

        <div class="divide-y divide-dathua-border">
          <label v-for="opt in SEVERITY_OPTIONS" :key="opt.key" class="flex items-center justify-between gap-4 py-3.5 cursor-pointer">
            <div class="flex items-center gap-2.5">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: opt.color }"></span>
              <div>
                <p class="text-sm text-white">{{ opt.label }}</p>
                <p class="text-xs text-dathua-text-soft">{{ opt.hint }}</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              :aria-checked="prefsForm[opt.key]"
              class="relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 cursor-pointer"
              :class="prefsForm[opt.key] ? 'bg-dathua-orange' : 'bg-white/10'"
              @click="prefsForm[opt.key] = !prefsForm[opt.key]"
            >
              <span
                class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200"
                :class="prefsForm[opt.key] ? 'translate-x-5' : 'translate-x-0'"
              ></span>
            </button>
          </label>
        </div>

        <p v-if="prefsSaved" class="text-xs text-white bg-white/5 border border-dathua-border rounded-lg px-3 py-2 mt-4">Preferencias actualizadas.</p>
        <button
          type="button"
          :disabled="savingPrefs"
          class="mt-5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-dathua-orange text-white hover:bg-[#B45309] transition-colors duration-200 cursor-pointer disabled:opacity-50"
          @click="savePreferences"
        >
          {{ savingPrefs ? 'Guardando…' : 'Guardar preferencias' }}
        </button>
      </div>

      <div class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
        <h2 class="text-white font-semibold mb-1">Historial de notificaciones</h2>
        <p class="text-dathua-text-soft text-xs mb-5">
          Cuánto tiempo quieres conservar tus notificaciones antes de que se borren solas.
          Siempre puedes borrarlas a mano desde el <router-link to="/dashboard/notifications" class="text-dathua-orange hover:text-white">historial completo</router-link>.
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="opt in RETENTION_OPTIONS"
            :key="String(opt.value)"
            type="button"
            class="px-4 py-2 rounded-lg text-sm font-medium border transition-colors duration-200 cursor-pointer"
            :class="prefsForm.retentionDays === opt.value
              ? 'bg-dathua-orange/10 border-dathua-orange text-dathua-orange'
              : 'border-dathua-border text-dathua-text-soft hover:text-white hover:border-white/30'"
            @click="prefsForm.retentionDays = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <p class="text-xs text-dathua-text-soft">
        Hoy las notificaciones llegan en vivo mientras tienes el dashboard abierto. Cuando exista la app móvil de DatHua, se enviarán como notificación push usando estas mismas preferencias.
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed, reactive, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import * as api from '../../services/api'
import { ROLE_COLOR } from '../../utils/status'
import TextField from '../../components/form/TextField.vue'

const SEVERITY_OPTIONS = [
  { key: 'notifyCritical', label: 'Crítica', hint: 'Un equipo clave dejó de responder o está en falla total.', color: ROLE_COLOR.critical },
  { key: 'notifyHigh', label: 'Alta', hint: 'Degradación seria: latencia muy alta, pérdida sostenida.', color: ROLE_COLOR.serious },
  { key: 'notifyMedium', label: 'Media', hint: 'Algo fuera de lo normal, sin ser urgente.', color: ROLE_COLOR.warning },
  { key: 'notifyLow', label: 'Baja / informativa', hint: 'Avisos menores. La mayoría prefiere dejarla apagada.', color: ROLE_COLOR.neutral },
]

const RETENTION_OPTIONS = [
  { value: 7, label: '7 días' },
  { value: 30, label: '30 días' },
  { value: null, label: 'Nunca' },
]

const route = useRoute()
const auth = useAuthStore()

const tab = ref(route.query.tab === 'notifications' ? 'notifications' : 'account')

const me = ref(null)
const profileForm = reactive({ name: '', email: '' })
const profileError = ref('')
const profileSaved = ref(false)
const savingProfile = ref(false)

const passwordForm = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const passwordError = ref('')
const passwordSaved = ref(false)
const savingPassword = ref(false)

const prefsForm = reactive({ notifyCritical: true, notifyHigh: true, notifyMedium: false, notifyLow: false, retentionDays: 30 })
const prefsSaved = ref(false)
const savingPrefs = ref(false)

async function loadProfile() {
  me.value = await api.getMe(auth.token)
  profileForm.name = me.value.name
  profileForm.email = me.value.email
}

async function loadPreferences() {
  const prefs = await api.getNotificationPreferences(auth.token)
  prefsForm.notifyCritical = Boolean(prefs.notifyCritical)
  prefsForm.notifyHigh = Boolean(prefs.notifyHigh)
  prefsForm.notifyMedium = Boolean(prefs.notifyMedium)
  prefsForm.notifyLow = Boolean(prefs.notifyLow)
  prefsForm.retentionDays = prefs.retentionDays === null || prefs.retentionDays === undefined ? null : Number(prefs.retentionDays)
}

async function saveProfile() {
  profileError.value = ''
  profileSaved.value = false
  savingProfile.value = true
  try {
    const { user } = await api.updateMe(auth.token, { name: profileForm.name, email: profileForm.email })
    auth.setSession(auth.token, { ...auth.user, name: user.name, email: user.email })
    profileSaved.value = true
    setTimeout(() => (profileSaved.value = false), 3000)
  } catch (e) {
    profileError.value = e.message
  } finally {
    savingProfile.value = false
  }
}

async function savePassword() {
  passwordError.value = ''
  passwordSaved.value = false

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordError.value = 'Las contraseñas nuevas no coinciden.'
    return
  }

  savingPassword.value = true
  try {
    await api.changePassword(auth.token, {
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    })
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    passwordSaved.value = true
    setTimeout(() => (passwordSaved.value = false), 3000)
  } catch (e) {
    passwordError.value = e.message
  } finally {
    savingPassword.value = false
  }
}

async function savePreferences() {
  savingPrefs.value = true
  prefsSaved.value = false
  try {
    await api.updateNotificationPreferences(auth.token, { ...prefsForm })
    prefsSaved.value = true
    setTimeout(() => (prefsSaved.value = false), 3000)
  } finally {
    savingPrefs.value = false
  }
}

onMounted(() => {
  loadProfile()
  loadPreferences()
})
</script>
