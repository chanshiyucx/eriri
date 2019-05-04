<template>
  <div id="comic">
    <Loading v-show="loading" />
    <ul class="viwer">
      <li v-for="item in pageFile" :key="item.filename">
        <img :src="item.filepath" :alt="item.name" />
      </li>
    </ul>
    <div class="mask">
      <div @click="handlePage('prev')"></div>
      <div @click="option = true"></div>
      <div @click="handlePage('next')"></div>
    </div>
    <div class="option">
      <VueSlider v-model="inx" :min="0" :max="files.length - 1" />
    </div>
  </div>
</template>

<script>
import path from 'path'
import fs from 'fs'
import VueSlider from 'vue-slider-component'
import 'vue-slider-component/theme/antd.css'
import Loading from '@/components/Loading'

export default {
  name: 'comic',
  components: { VueSlider, Loading },
  data() {
    return {
      loading: false,
      option: false,
      filename: '',
      filedir: '',
      files: [],
      inx: 0, // 当前索引
      page: 1, // 单页或者双页模式
      adapt: 'height' // 适应高度or宽度
    }
  },
  computed: {
    pageFile() {
      return this.files.slice(this.inx, this.inx + this.page)
    }
  },
  mounted() {
    const { filename, filedir } = this.$route.query
    this.filename = filename
    this.filedir = filedir
    this.loadComic()
  },
  methods: {
    // 加载资源
    loadComic() {
      this.loading = true
      fs.readdir(this.filedir, (err, files) => {
        if (err) {
          this.loading = false
          return
        }
        this.files = files.map(filename => {
          const filepath = path.join(this.filedir, filename)
          return {
            filename,
            filepath
          }
        })
        this.loading = false
      })
    },
    // 翻页
    handlePage(type) {
      if (type === 'prev') {
        this.inx = Math.max(0, this.inx - this.page)
      } else {
        this.inx = Math.min(this.files.length - 1, this.inx + this.page)
      }
    }
  }
}
</script>
<style lang="less" scoped>
#comic {
  position: relative;
  .viwer {
    display: flex;
    justify-content: space-around;
    height: 100%;
    img {
      height: 100%;
    }
  }
  .mask {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    > div {
      flex: 1;
    }
  }
}
</style>
