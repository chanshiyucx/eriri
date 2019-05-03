<template>
  <div class="header">
    <ul>
      <li class="minus" @click="handleScreen('minimize')"></li>
      <li class="plus" @click="handleScreen('maximize')"></li>
      <li @click="handleScreen('close')">
        <svg-icon icon-class="close" />
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  name: 'Header',
  methods: {
    // 处理窗口大小
    handleScreen(type) {
      this.$ipcRenderer.send('toggle-screen', type)
    }
  }
}
</script>
<style lang="less" scoped>
.header {
  float: right;
  ul {
    display: flex;
    li {
      width: 34px;
      height: 30px;
      line-height: 30px;
      font-size: 10px;
      text-align: center;
      color: #aaa;
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
        width: 12px;
        height: 1px;
        background-color: #aaa;
        transform: scaleY(1.3);
      }
    }
    .plus {
      line-height: 32px;
      &::after {
        content: '';
        display: inline-block;
        width: 8px;
        height: 8px;
        border: 1px solid #aaa;
        border-radius: 1px;
      }
    }
  }
}
</style>
