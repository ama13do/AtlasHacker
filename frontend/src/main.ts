import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@fontsource-variable/parkinsans'
import 'maplibre-gl/dist/maplibre-gl.css'
import './style.css'
import App from './App.vue'
import router from '@/core/router'

createApp(App).use(createPinia()).use(router).mount('#app')
