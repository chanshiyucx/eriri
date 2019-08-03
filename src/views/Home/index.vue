<template>
  <div ref="home" id="home">
    <Loading v-show="loading" />
    <div v-if="!comicList.length" class="open-folder" @click="openFolder">
      <svg-icon icon-class="folders" />
      <span>添加本地文件夹</span>
    </div>
    <ul class="comic-list">
      <li v-for="item in comicList" :key="item.filename" @click="gotoViwer(item)">
        <img :src="item.coverPath" :alt="item.coverName" />
        <div class="info">
          <h3>{{ item.filename }}</h3>
          <div class="meta">共 {{ item.imgCount }} 页</div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script>
import Loading from '@/components/Loading'
import mixin from '@/mixins/index.js'

export default {
  name: 'Home',
  components: { Loading },
  mixins: [mixin],
  data() {
    return {
      comicList: [],
      timerId: '',
      scrollTop: 0
    }
  },
  watch: {
    list() {
      this.loadAssets()
    },
    $route(val) {
      if (val.name === 'home') {
        this.$refs.home.scrollTop = this.scrollTop || 0
      }
    }
  },
  mounted() {
    this.loadAssets()

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
      this.comicList = this.list[this.curInx] ? this.list[this.curInx].comicList : []
    },
    // 进入预览
    gotoViwer(item) {
      this.$router.push({
        path: 'comic',
        query: {
          filename: item.filename,
          filedir: item.filedir
        }
      })
    }
  }
}
</script>
<style lang="less" scoped>
#home {
  .open-folder {
    cursor: pointer;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin: 100px auto 50px;
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
    margin: 0 40px;
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
    img {
      width: 150px;
      height: 220px;
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
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        font-weight: normal;
        line-height: 1.2;
        font-size: 14px;
        word-break: break-word;
      }
      .meta {
        margin-top: 4px;
        color: #aaa;
        font-size: 14px;
        line-height: 1.6;
      }
    }
  }
}
</style>
