import Vue from 'vue'
import { ipcRenderer } from 'electron'
import App from './App.vue'
import router from './router'
import store from './store'
import dataStore from './utils/dataStore'

// 全局样式与字体图标
import './assets/style/layout.less'
import './assets/icons'

Vue.config.productionTip = false
Vue.prototype.$dataStore = dataStore
Vue.prototype.$ipcRenderer = ipcRenderer

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
