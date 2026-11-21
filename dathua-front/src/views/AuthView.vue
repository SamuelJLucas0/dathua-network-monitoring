<template>
  <div class="h-screen flex bg-dathua-bg overflow-hidden">
    <!-- ============================================
         PANEL IZQUIERDO — marca (oculto en mobile)
         h-full fijo: nunca depende del alto del formulario
    ============================================= -->
    <div class="hidden lg:flex lg:w-[45%] h-full relative flex-col justify-between p-12 overflow-hidden bg-dathua-card border-r border-dathua-border">
      <div class="absolute inset-0 pointer-events-none">
        <div class="absolute top-[10%] -left-24 w-72 h-72 bg-dathua-orange/10 rounded-full blur-3xl animate-glow"></div>
        <div class="absolute bottom-[8%] -right-16 w-80 h-80 bg-dathua-orange/10 rounded-full blur-3xl animate-glow" style="animation-delay: 3s"></div>
        <svg class="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 500 700" preserveAspectRatio="xMidYMid slice">
          <line x1="80" y1="120" x2="260" y2="220" stroke="#2B3540" stroke-width="1.5" />
          <line x1="260" y1="220" x2="120" y2="360" stroke="#2B3540" stroke-width="1.5" />
          <line x1="260" y1="220" x2="420" y2="300" stroke="#2B3540" stroke-width="1.5" />
          <line x1="120" y1="360" x2="300" y2="480" stroke="#2B3540" stroke-width="1.5" />
          <line x1="420" y1="300" x2="300" y2="480" stroke="#2B3540" stroke-width="1.5" />
          <line x1="300" y1="480" x2="200" y2="600" stroke="#2B3540" stroke-width="1.5" />

          <circle cx="80" cy="120" r="5" fill="#D96B14" class="animate-pulse-node" />
          <circle cx="260" cy="220" r="5" fill="#D96B14" class="animate-pulse-node" style="animation-delay:0.3s" />
          <circle cx="420" cy="300" r="5" fill="#D96B14" class="animate-pulse-node" style="animation-delay:0.6s" />
          <circle cx="120" cy="360" r="5" fill="#D96B14" class="animate-pulse-node" style="animation-delay:0.9s" />
          <circle cx="300" cy="480" r="5" fill="#D96B14" class="animate-pulse-node" style="animation-delay:1.2s" />
          <circle cx="200" cy="600" r="5" fill="#D96B14" class="animate-pulse-node" style="animation-delay:1.5s" />
        </svg>
      </div>

      <router-link to="/" class="relative z-10 inline-flex items-center gap-2 group w-fit">
        <img src="/logo.png" alt="DatHua" class="h-14 w-auto transition-transform duration-300 group-hover:scale-105" />
      </router-link>

      <div class="relative z-10 max-w-sm">
        <h2 class="font-heading text-3xl font-bold text-white leading-tight mb-4">
          La observabilidad de red que tu PyME necesita
        </h2>
        <p class="text-dathua-text-soft text-sm leading-relaxed mb-8">
          Detecta anomalías antes de que se conviertan en una caída total, sin contratar a nadie
          experto en redes.
        </p>
        <ul class="space-y-4">
          <li v-for="point in points" :key="point" class="flex items-start gap-3 text-sm text-gray-300">
            <span class="mt-0.5 w-5 h-5 shrink-0 rounded-md bg-dathua-orange/10 border border-dathua-orange/30 flex items-center justify-center text-dathua-orange">
              <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </span>
            {{ point }}
          </li>
        </ul>
      </div>

      <p class="relative z-10 text-xs text-dathua-text-soft/60">
        &copy; {{ year }} DatHua. Todos los derechos reservados.
      </p>
    </div>

    <!-- ============================================
         PANEL DERECHO — formulario
         h-full + overflow-y-auto: si el formulario es más
         alto que la pantalla, hace scroll interno en vez de
         estirar toda la fila (y con ella, el panel izquierdo)
    ============================================= -->
    <div class="flex-1 h-full overflow-y-auto relative">
      <router-link to="/" class="lg:hidden absolute top-6 left-6 inline-flex items-center gap-2 z-10">
        <img src="/logo.png" alt="DatHua" class="h-11 w-auto" />
      </router-link>

      <div class="min-h-full flex flex-col items-center justify-center [justify-content:safe_center] px-6 py-12 sm:px-10">
        <div class="w-full max-w-sm">
          <!-- Tabs -->
          <div class="relative bg-dathua-card border border-dathua-border rounded-full p-0.5 mb-8 shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)] max-w-[280px] mx-auto">
            <div class="relative grid grid-cols-2">
              <span
                class="absolute inset-y-0 left-0 w-1/2 rounded-full bg-dathua-orange shadow-[0_2px_10px_rgba(217,107,20,0.4)] transition-transform duration-300 ease-out"
                :class="mode === 'register' ? 'translate-x-full' : 'translate-x-0'"
                aria-hidden="true"
              ></span>
              <button
                type="button"
                class="relative z-10 py-1.5 text-xs font-semibold rounded-full transition-colors duration-300 cursor-pointer"
                :class="mode === 'login' ? 'text-white' : 'text-dathua-text-soft hover:text-white'"
                @click="setMode('login')"
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                class="relative z-10 py-1.5 text-xs font-semibold rounded-full transition-colors duration-300 cursor-pointer"
                :class="mode === 'register' ? 'text-white' : 'text-dathua-text-soft hover:text-white'"
                @click="setMode('register')"
              >
                Crear cuenta
              </button>
            </div>
          </div>

          <transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-1"
            mode="out-in"
          >
            <!-- ============ LOGIN ============ -->
            <form v-if="mode === 'login'" key="login" class="space-y-5" @submit.prevent="handleLogin">
              <div>
                <h1 class="font-heading text-2xl font-bold text-white mb-1">Bienvenido de vuelta</h1>
                <p class="text-dathua-text-soft text-sm">Entra a tu panel de monitoreo.</p>
              </div>

              <div v-if="error" class="text-sm text-red-400 bg-red-500/10 border border-red-400/30 rounded-lg px-4 py-3">
                {{ error }}
              </div>

              <TextField v-model="loginForm.email" type="email" label="Correo electrónico" placeholder="tu@negocio.com" autocomplete="email" required />
              <PasswordField v-model="loginForm.password" label="Contraseña" autocomplete="current-password" required />

              <button type="submit" :disabled="loading" class="w-full flex items-center justify-center gap-2 bg-dathua-orange hover:bg-dathua-orange-hover text-white font-medium py-3 rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:pointer-events-none">
                <span v-if="loading" class="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin"></span>
                {{ loading ? 'Entrando…' : 'Iniciar sesión' }}
              </button>

              <p class="text-center text-sm text-dathua-text-soft">
                ¿No tienes cuenta?
                <button type="button" class="text-dathua-orange hover:text-dathua-orange-hover font-medium hover:underline underline-offset-2" @click="setMode('register')">
                  Regístrate gratis
                </button>
              </p>
            </form>

            <!-- ============ REGISTRO ============ -->
            <form v-else key="register" class="space-y-5" @submit.prevent="handleRegister">
              <div>
                <h1 class="font-heading text-2xl font-bold text-white mb-1">Crea tu cuenta</h1>
                <p class="text-dathua-text-soft text-sm">{{ trialDays }} días de prueba gratis, sin tarjeta.</p>
              </div>

              <div v-if="error" class="text-sm text-red-400 bg-red-500/10 border border-red-400/30 rounded-lg px-4 py-3">
                {{ error }}
              </div>

              <TextField v-model="registerForm.orgName" label="Nombre de tu negocio" placeholder="Farmacia El Buen Precio" autocomplete="organization" required />
              <TextField v-model="registerForm.userName" label="Tu nombre" placeholder="Ana Torres" autocomplete="name" required />
              <TextField v-model="registerForm.email" type="email" label="Correo electrónico" placeholder="tu@negocio.com" autocomplete="email" required />
              <PasswordField v-model="registerForm.password" label="Contraseña" autocomplete="new-password" hint="Mínimo 8 caracteres" required />
              <PasswordField v-model="registerForm.confirmPassword" label="Confirmar contraseña" autocomplete="new-password" required />

              <button type="submit" :disabled="loading" class="w-full flex items-center justify-center gap-2 bg-dathua-orange hover:bg-dathua-orange-hover text-white font-medium py-3 rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:pointer-events-none">
                <span v-if="loading" class="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin"></span>
                {{ loading ? 'Creando cuenta…' : 'Empezar prueba gratis' }}
              </button>

              <p class="text-center text-xs text-dathua-text-soft/70 leading-relaxed">
                Al crear tu cuenta aceptas los
                <a href="/terminos" class="text-dathua-orange hover:underline underline-offset-2">Términos y condiciones</a>
                y el
                <a href="/privacidad" class="text-dathua-orange hover:underline underline-offset-2">Aviso de privacidad</a>.
              </p>

              <p class="text-center text-sm text-dathua-text-soft">
                ¿Ya tienes cuenta?
                <button type="button" class="text-dathua-orange hover:text-dathua-orange-hover font-medium hover:underline underline-offset-2" @click="setMode('login')">
                  Inicia sesión
                </button>
              </p>
            </form>
          </transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as authApi from '../services/api'
import { useAuthStore } from '../stores/auth'
import TextField from '../components/form/TextField.vue'
import PasswordField from '../components/form/PasswordField.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const year = new Date().getFullYear()
const trialDays = 30

const points = [
  'Alertas en tiempo real, antes de que tus clientes lo noten',
  'IA que aprende el comportamiento normal de tu red',
  'Hasta 3 sucursales bajo un mismo panel',
]

const mode = ref(route.name === 'register' ? 'register' : 'login')
const loading = ref(false)
const error = ref('')

const loginForm = reactive({ email: '', password: '' })
const registerForm = reactive({ orgName: '', userName: '', email: '', password: '', confirmPassword: '' })

watch(
  () => route.name,
  (name) => {
    mode.value = name === 'register' ? 'register' : 'login'
  },
)

function setMode(next) {
  error.value = ''
  if (mode.value === next) return
  mode.value = next
  router.replace({ name: next })
}

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    const data = await authApi.login(loginForm.email, loginForm.password)
    authStore.setSession(data.token, data.user)
    router.push('/dashboard')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  error.value = ''

  if (registerForm.password.length < 8) {
    error.value = 'La contraseña debe tener al menos 8 caracteres.'
    return
  }
  if (registerForm.password !== registerForm.confirmPassword) {
    error.value = 'Las contraseñas no coinciden.'
    return
  }

  loading.value = true
  try {
    const data = await authApi.register(
      registerForm.orgName,
      registerForm.userName,
      registerForm.email,
      registerForm.password,
    )
    authStore.setSession(data.token, data.user)
    router.push('/dashboard')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>
