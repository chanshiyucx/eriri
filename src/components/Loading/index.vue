<template>
  <div class="loading">
    <img src="@/assets/img/loading.gif" alt="loading" />
  </div>
</template>

<style lang="less" scoped>
.loading {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.5);
  z-index: 100;
  img {
    width: 80px;
  }
}
</style>
