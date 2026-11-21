import { defineStore } from 'pinia'

const STORAGE_KEY = 'dathua_session'

function readStoredSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return { token: parsed?.token ?? null, user: parsed?.user ?? null }
  } catch {
    return { token: null, user: null }
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => readStoredSession(),
  getters: {
    isAuthenticated: (state) => Boolean(state.token),
  },
  actions: {
    setSession(token, user) {
      this.token = token
      this.user = user
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }))
    },
    logout() {
      this.token = null
      this.user = null
      localStorage.removeItem(STORAGE_KEY)
    },
  },
})
