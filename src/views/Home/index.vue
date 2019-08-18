<template>
  <div ref="home" id="home">
    <div v-if="!comicList.length" class="open-folder" @click="openFolder">
      <svg-icon icon-class="folders" />
      <span>添加本地文件夹</span>
    </div>
    <ul class="comic-list">
      <li v-for="item in comicList" :key="item.filename" @click="gotoViwer(item)">
        <img :src="item.coverPath" :alt="item.coverName" />
        <div class="info">
          <h3>{{ item.filename }}</h3>
          <div class="meta">
            <span>{{ item.progress ? `${item.progress}/${item.imgCount}` : '未读' }}</span>
            <span>共 {{ item.imgCount }} 页</span>
          </div>
        </div>
      </li>
      <li v-for="i in 10" :key="i" class="empty" />
    </ul>
  </div>
</template>

<script>
export default {
  name: 'Home',
  props: {
    list: {
      type: Array,
      default: () => []
    },
    curInx: {
      type: Number,
      default: 0
    }
  },
  data() {
    return {
      comicList: [],
      timerId: '',
      scrollTop: 0
    }
  },
  watch: {
    list: {
      immediate: true,
      deep: true,
      handler() {
        this.loadAssets()
      }
    },
    curInx() {
      this.loadAssets()
    },
    $route(val) {
      if (val.name === 'home') {
        this.$refs.home.scrollTop = this.scrollTop || 0
      }
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.$refs.home.onscroll = this.justifyPos
    })
  },
  methods: {
    justifyPos() {
      if (this.timerId) return
      this.timerId = setTimeout(() => {
        this.timerId = null
        this.scrollTop = this.$refs.home.scrollTop
      }, 500)
    },
    // 初始化
    loadAssets() {
      const comicList = this.list[this.curInx] ? this.list[this.curInx].comicList : []
      this.comicList = [...comicList]
    },
    // 进入预览
    gotoViwer(item) {
      this.$router.push({
        path: 'comic',
        query: {
          filename: item.filename,
          filedir: item.filedir,
          progress: item.progress
        }
      })
    },
    // 打开文件夹
    openFolder() {
      this.$emit('openFolder')
    }
  }
}
</script>
<style lang="less" scoped>
#home {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  .open-folder {
    cursor: pointer;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin: 100px auto 0;
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

  .comic-list {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-around;
    margin: 0 30px;
    padding: 10px 10px 0;
    li {
      margin: 2px;
      padding: 6px;
      cursor: pointer;
      border: 2px solid #444;
      transition: border 0.25s ease-in-out;
      &:hover {
        border: 2px solid #666;
      }
    }
    .empty {
      margin: 0;
      padding: 0;
      width: 172px;
      height: 0;
    }
    img {
      width: 156px;
      height: 230px;
      object-fit: cover;
    }
    .info {
      margin-top: 5px;
      width: 150px;
      text-align: left;
      color: #eee;

      h3 {
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        height: 34px;
        line-height: 17px;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        font-weight: normal;
        font-size: 14px;
        word-break: break-word;
      }
      .meta {
        display: flex;
        justify-content: space-between;
        color: #aaa;
        font-size: 14px;
        line-height: 1.6;
      }
    }
  }
}
</style>
