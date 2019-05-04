<template>
  <div class="header">
    <ul>
      <li class="minus" @click="handleScreen('minimize')"></li>
      <li @click="handleScreen('maximize')">
        <svg-icon v-if="maximize" icon-class="unmaximize" />
        <svg-icon v-else icon-class="maximize" />
      </li>
      <li @click="handleScreen('close')">
        <svg-icon icon-class="close" />
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  name: 'Header',
  data() {
    return {
      maximize: false
    }
  },
  methods: {
    // 处理窗口大小
    handleScreen(type) {
      let screenType = type
      if (type === 'maximize') {
        this.maximize = !this.maximize
        screenType = this.maximize ? 'maximize' : 'unmaximize'
      }
      this.$ipcRenderer.send('toggle-screen', screenType)
    }
  }
}
</script>
<style lang="less" scoped>
.header {
  position: fixed;
  top: 0;
  right: 5px;
  background-color: #fcfcfc;
  z-index: 100;
  ul {
    display: flex;
    li {
      width: 34px;
      height: 30px;
      line-height: 30px;
      font-size: 12px;
      text-align: center;
      color: #888;
      cursor: pointer;
      &:hover {
        background-color: #ddd;
      }
    }
    .minus {
      line-height: 24px;
      &::after {
        content: '';
        display: inline-block;
        width: 13px;
        height: 1px;
        background-color: #888;
        transform: scaleY(1.3);
      }
    }
  }
}
</style>
