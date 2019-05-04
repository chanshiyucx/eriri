<template>
  <div id="app">
    <Menu />
    <div class="container">
      <Header />
      <router-view class="main" />
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
  mounted() {
    // 注册键盘监听事件
    window.addEventListener('keydown', this.keydown, false)
  },
  methods: {
    keydown({ keyCode }) {
      console.log({ keyCode })
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
    height: calc(100% - 30px);
    overflow-y: auto;
    &::-webkit-scrollbar {
      width: 5px;
      height: 5px;
      background-color: transparent;
    }
    &::-webkit-scrollbar-thumb {
      border-radius: 3px;
      background-color: #ccc;
    }
    &::-webkit-scrollbar-track {
      background-color: transparent;
    }
  }
}
</style>
