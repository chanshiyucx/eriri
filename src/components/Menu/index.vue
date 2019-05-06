<template>
  <div id="menu">
    <div class="logo">
      <img src="@/assets/img/app.png" alt="logo" />
    </div>
    <router-link to="/">
      <svg-icon icon-class="home" />
    </router-link>
    <router-link to="/list">
      <svg-icon icon-class="star" />
    </router-link>
  </div>
</template>

<script>
export default {
  name: 'Menu'
}
</script>
<style lang="less" scoped>
#menu {
  width: 50px;
  height: 100%;
  background-color: #222;
  .logo {
    width: 50px;
    height: 50px;
    text-align: center;
    img {
      margin-top: 10px;
      width: 30px;
      height: 30px;
    }
  }
  a {
    display: block;
    height: 50px;
    line-height: 50px;
    text-align: center;
    font-size: 18px;
    color: #fff;
    &.router-link-exact-active {
      background-color: #b980ae;
    }
  }
}
</style>
