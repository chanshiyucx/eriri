<template>
  <div id="app">
    <Menu v-show="!hideMenu" />
    <div class="container">
      <Header :hideMenu="hideMenu" />
      <router-view class="main scroll" />
    </div>
  </div>
</template>

<script>
import Header from '@/components/Header'
import Menu from '@/components/Menu'

export default {
  name: 'app',
  components: {
    Header,
    Menu
  },
  data() {
    return {
      hideMenu: false
    }
  },
  watch: {
    $route(val) {
      this.hideMenu = val.name === 'comic'
    }
  },
  mounted() {
    // 注册键盘监听事件
    window.addEventListener('keydown', this.keydown, false)
  },
  methods: {
    keydown({ keyCode }) {
      /**
       * 123: F12
       */
      switch (keyCode) {
        case 123:
          this.toggleDevTools()
          break
        default:
          break
      }
    },
    toggleDevTools() {
      this.$ipcRenderer.send('toggle-devtools')
    }
  }
}
</script>

<style lang="less">
#app {
  display: flex;
  justify-content: flex-start;
  width: 100%;
  height: 100%;
  text-align: center;
  background-color: #fcfcfc;
  .container {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .main {
    width: 100%;
  }
}
</style>
