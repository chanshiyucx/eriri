import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

export default new Router({
  base: process.env.BASE_URL,
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./views/Home/index.vue')
    },
    {
      path: '/comic',
      name: 'comic',
      component: () => import('./views/Comic/index.vue')
    },
    {
      path: '/list',
      name: 'list',
      component: () => import('./views/List/index.vue')
    }
  ]
})
