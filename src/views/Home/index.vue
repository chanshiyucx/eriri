<template>
  <div id="home">
    <ul class="comic-list">
      <li v-for="item in comicList" :key="item.filename" @click="gotoViwer(item)">
        <img :src="item.coverPath" :alt="item.coverName" />
        <div class="info">
          <h3>{{ item.filename }}</h3>
          <div class="meta">{{ item.progress ? `${item.progress}/${item.imgCount}` : '未读' }}</div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  name: 'home',
  data() {
    return {
      loading: false,
      list: [], // 所有目录列表
      curInx: 0, // 当前的目录索引
      comicList: []
    }
  },
  mounted() {
    this.init()
  },
  methods: {
    // 初始化
    init() {
      // 目录列表
      this.list = this.$dataStore.get('list') || []
      // 当前的目录索引
      this.curInx = this.$dataStore.get('curInx') || 0
      // 当前的漫画列表
      this.comicList = this.list[this.curInx] ? this.list[this.curInx].comicList : []
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
    }
  }
}
</script>
<style lang="less" scoped>
#home {
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
