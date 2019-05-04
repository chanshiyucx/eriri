<template>
  <div id="comic">
    <Loading v-show="loading" />
    <ul class="viwer">
      <li v-for="item in pageFile" :key="item.filename">
        <img
          :class="adapt === 'height' ? 'adapt-height' : 'adapt-width'"
          :src="item.filepath"
          :alt="item.name"
        />
      </li>
    </ul>
    <div class="mask">
      <div @click="handlePage('prev')"></div>
      <div @click="option = true"></div>
      <div @click="handlePage('next')"></div>
    </div>
    <div v-show="option" class="option">
      <div class="option-mask" @click="option = false"></div>
      <ul class="menu">
        <li @click="switchAdapt">
          {{ adapt === 'height' ? '适应宽度' : '适应高度' }}
        </li>
      </ul>
      <div class="slider">
        <span>0</span>
        <VueSlider
          class="vue-slider"
          v-model="inx"
          :min="0"
          :max="Math.max(files.length - 1, 0)"
          :dotOptions="dotOptions"
          :processStyle="{ backgroundColor: '#b980ae' }"
        />
        <span>{{ files.length - 1 }}</span>
      </div>
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
      page: 2, // 单页或者双页模式
      adapt: 'height' // 适应高度or宽度
    }
  },
  computed: {
    pageFile() {
      return this.files.slice(this.inx, this.inx + this.page)
    },
    dotOptions() {
      return {
        style: {
          borderColor: '#b980ae'
        },
        focusStyle: {
          boxShadow: '0 0 0 5px rgba(185, 128, 174, .4)'
        },
        tooltipStyle: {
          color: '#b980ae',
          borderColor: '#fff',
          backgroundColor: '#fff'
        }
      }
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
    },
    // 切换模式
    switchAdapt() {
      this.adapt = this.adapt === 'height' ? 'width' : 'height'
    }
  }
}
</script>
<style lang="less" scoped>
#comic {
  position: relative;
  height: 100%;
  overflow-y: auto;
  .viwer {
    display: flex;
    justify-content: space-around;
    height: 100%;
    li {
      width: 100%;
      img {
        display: block;
        margin: 0 auto;
      }
      .adapt-width {
        min-width: 100%;
        object-fit: cover;
        object-position: top;
      }
      .adapt-height {
        height: 100%;
        object-fit: contain;
      }
    }
  }
  .mask {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 50px;
    right: 0;
    display: flex;
    > div {
      flex: 1;
    }
  }
  .option {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 50px;
    right: 0;
    .option-mask {
      position: absolute;
      width: 100%;
      height: 100%;
    }
    .menu {
      position: absolute;
      top: 40px;
      right: 0;
      height: 50px;
      background: #fcc;
    }
    .slider {
      position: absolute;
      left: 0;
      bottom: 0;
      width: 100%;
      height: 50px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: #f2c047;
      > span {
        display: inline-block;
        width: 40px;
        color: #fff;
      }
      .vue-slider {
        flex: 1;
      }
    }
  }
}
</style>
