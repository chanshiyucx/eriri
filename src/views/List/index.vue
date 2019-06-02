<template>
  <div id="list">
    <Loading v-show="loading" />
    <div class="open-folder" @click="openFolder">
      <svg-icon icon-class="folders" />
      <span>添加本地文件夹</span>
    </div>
    <div class="wrapper scroll">
      <ul>
        <li
          v-for="(item, i) in list"
          :key="item.path"
          :class="curInx === i && 'active'"
          @click="setCurInx(i)"
        >
          <span>
            <svg-icon icon-class="folder" />
            {{ item.name }}
          </span>
          <span class="path">{{ item.path }}</span>
          <span>
            <span>{{ item.comicCount }} 本漫画</span>
            <span class="trash" @click.stop="handleDelete(i)">
              <svg-icon icon-class="trash" />
            </span>
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
<script>
import Loading from '@/components/Loading'
import mixin from '@/mixins/index.js'

export default {
  name: 'list',
  components: { Loading },
  mixins: [mixin],
  methods: {
    // 删除目录
    handleDelete(i) {
      this.list.splice(i, 1)
    },
    // 设置首页目录
    setCurInx(i) {
      this.curInx = i
      this.$dataStore.set('curInx', this.curInx)
      this.$router.push({ path: '/' })
    }
  }
}
</script>
<style lang="less" scoped>
#list {
  padding: 100px 20px;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  .open-folder {
    cursor: pointer;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin: 0 auto;
    width: 180px;
    height: 120px;
    border-radius: 3px;
    color: #eee;
    text-align: center;
    letter-spacing: 1px;
    box-shadow: 0 3px 10px #333;
    background-color: #b980ae;
    svg {
      margin-bottom: 10px;
      font-size: 42px;
    }
  }

  .wrapper {
    margin: 20px auto 0;
    width: 80%;
    max-height: calc(100% - 60px);
    border-radius: 3px;
    background-color: #222;
    overflow-y: auto;
  }
  ul {
    cursor: pointer;
    color: #eee;
    li {
      display: flex;
      justify-content: space-between;
      padding: 0 8px 0 15px;
      width: 100%;
      height: 48px;
      line-height: 48px;
      box-sizing: border-box;
      transition: background 0.25s ease-in-out;
      &:hover,
      &.active {
        background-color: #b980ae;
      }
      > span {
        flex: 1;
        display: inline-block;
        text-align: left;
        svg {
          margin-right: 5px;
        }
      }
      > span:last-child {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .path {
        flex: 3;
        color: #ddd;
      }
      .trash {
        display: inline-block;
        width: 40px;
        height: 40px;
        line-height: 40px;
        text-align: center;
      }
    }
  }
}
</style>
