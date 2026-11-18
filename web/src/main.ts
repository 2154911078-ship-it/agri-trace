import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import './styles/tokens.css'
import './styles/table.css'
import './styles/layout.css'
import './styles/modules.css'

createApp(App).use(router).mount('#app')