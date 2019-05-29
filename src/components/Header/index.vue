<template>
  <div class="header">
    <div v-show="hideMenu" class="back" @click="goBack">
      <svg-icon icon-class="back" />
    </div>
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
import { ipcRenderer } from 'electron'

export default {
  name: 'Header',
  props: {
    hideMenu: {
      type: Boolean,
      default: false
    }
  },
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
      ipcRenderer.send('toggle-screen', screenType)
    },
    // 返回
    goBack() {
      this.$router.go(-1)
    }
  }
}
</script>
<style lang="less" scoped>
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 5px;
  height: 30px;
  z-index: 100;
  .back {
    float: left;
    width: 34px;
    height: 30px;
    line-height: 30px;
    font-size: 14px;
    text-align: center;
    color: #eee;
    cursor: pointer;
    &:hover {
      background-color: #888;
    }
  }
  ul {
    display: flex;
    float: right;
    height: 100%;
    li {
      width: 34px;
      line-height: 30px;
      font-size: 12px;
      text-align: center;
      color: #eee;
      cursor: pointer;
      &:hover {
        background-color: #888;
      }
    }
    .minus {
      line-height: 24px;
      &::after {
        content: '';
        display: inline-block;
        width: 13px;
        height: 1px;
        background-color: #eee;
        transform: scaleY(1.3);
      }
    }
  }
}
</style>
