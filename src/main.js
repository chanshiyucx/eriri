import Vue from 'vue'
import App from './App.vue'
import router from './router'
import dataStore from './utils/dataStore'

// 全局样式与字体图标
import './assets/style/layout.less'
import './assets/icons'

Vue.config.productionTip = false
Vue.prototype.$dataStore = dataStore

new Vue({
  router,
  render: h => h(App)
}).$mount('#app')
