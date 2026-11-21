import { createApp } from 'vue'
import App from './App.vue'
import { vReveal } from './directives/reveal'
import './assets/styles.css'

const app = createApp(App)
app.directive('reveal', vReveal)
app.mount('#app')