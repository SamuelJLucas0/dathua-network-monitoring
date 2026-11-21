import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { vReveal } from './directives/reveal'
import './assets/styles.css'

const app = createApp(App)
app.use(createPinia())
app.directive('reveal', vReveal)
app.use(router)
app.mount('#app')
