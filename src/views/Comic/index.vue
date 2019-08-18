<template>
  <div id="comic" ref="comic">
    <Loading v-show="loading" />
    <ul
      :class="['viewer', pageFile.length === 2 && adapt === 'height' && 'center']"
      @click="handleClick"
    >
      <li
        v-for="item in pageFile"
        :key="item.filename"
        :style="{ width: pageFile.length === 1 ? '100%' : '50%' }"
      >
        <img
          :class="adapt === 'height' ? 'adapt-height' : 'adapt-width'"
          :src="item.filepath"
          :alt="item.name"
        />
      </li>
    </ul>
    <div v-show="option" class="option">
      <div class="option-mask" @click="option = false"></div>
      <div class="footer">
        <div class="slider">
          <span class="progress">{{ inx }}/{{ files.length }}</span>
          <span>1</span>
          <VueSlider
            class="vue-slider"
            v-model="inx"
            :min="1"
            :max="Math.max(files.length, 1)"
            :dotOptions="dotOptions"
            :processStyle="{ backgroundColor: '#eee' }"
          />
          <span>{{ files.length }}</span>
        </div>
        <ul class="menu">
          <li @click="switchAdapt">
            <svg-icon :icon-class="adapt === 'height' ? 'columnExpand' : 'rowExpand'" />
            {{ adapt === 'height' ? '适应高度' : '适应宽度' }}
          </li>
          <li @click="switchPage">
            <svg-icon :icon-class="page === 1 ? 'singlepage' : 'doublepage'" />
            {{ page === 1 ? '单页模式' : '双页模式' }}
          </li>
        </ul>
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
import { isImg } from '@/utils'

export default {
  name: 'Comic',
  components: { VueSlider, Loading },
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
      loading: false,
      option: false,
      filename: '',
      filedir: '',
      files: [],
      pageFile: [],
      inx: 1, // 当前索引
      page: 1, // 单页或者双页模式
      adapt: 'height', // 适应高度or宽度
      viewer: null,
      dotOptions: {
        style: {
          borderColor: '#df9dea'
        },
        focusStyle: {
          boxShadow: '0 0 0 5px rgba(255, 255, 255, .6)'
        },
        tooltipStyle: {
          color: '#b980ae',
          borderColor: '#fff',
          backgroundColor: '#fff'
        }
      },
      lastScroll: new Date()
    }
  },
  watch: {
    inx() {
      this.setPageFile()
    }
  },
  mounted() {
    this.adapt = this.$dataStore.get('adapt') || 'height'
    this.page = this.$dataStore.get('page') || 1

    const { filename, filedir, progress = 1 } = this.$route.query
    this.filename = filename
    this.filedir = filedir
    this.viewer = document.querySelector('.viewer')
    this.loadComic().then(() => {
      this.$nextTick(() => {
        this.inx = progress
        this.setPageFile()
      })
    })

    // 监听翻页
    window.addEventListener('keydown', this.keydown, false)
    window.addEventListener('wheel', this.handleScroll, false)
  },
  beforeDestroy() {
    const comicList = this.list[this.curInx] ? this.list[this.curInx].comicList : []
    const comic = comicList.find(o => o.filename === this.filename)
    if (comic) {
      comic.progress = this.inx
      const list = [...this.list]
      this.$emit('setList', list)
    }

    window.removeEventListener('keydown', this.keydown)
    window.removeEventListener('wheel', this.handleScroll)
  },
  methods: {
    keydown({ keyCode }) {
      switch (keyCode) {
        case 37: // ->
          this.changePage('prev')
          break
        case 39: // <-
          this.changePage('next')
          break
        default:
          break
      }
    },
    handleScroll(e) {
      if (this.adapt === 'height') {
        // 适应高度
        const now = new Date()
        if (now - this.lastScroll < 500) return
        this.lastScroll = now
        this.changePage(e.wheelDelta > 0 ? 'prev' : 'next')
      }
      this.option = false
    },
    // 加载资源
    loadComic() {
      return new Promise(resolve => {
        this.loading = true
        fs.readdir(this.filedir, (err, files) => {
          if (err) {
            this.loading = false
            return
          }
          // 筛选出图片文件
          this.files = files.filter(isImg).map(filename => {
            const filepath = path.join(this.filedir, filename)
            return {
              filename,
              filepath
            }
          })
          this.loading = false
          resolve()
        })
      })
    },
    setPageFile() {
      const val = this.inx - 1
      const pageFile = this.files.slice(val, val + this.page)

      // 在双页且适应高度时计算比例，如果有一张宽度超出则只显示一张
      if (this.page === 2 && pageFile.length === 2) {
        const seq = pageFile.map(o => {
          return new Promise(resolve => {
            const img = new Image()
            img.onload = () => {
              const { width, height } = img
              const radio = width / height
              resolve(radio)
            }
            img.src = o.filepath
          })
        })
        Promise.all(seq).then(result => {
          const { clientWidth, clientHeight } = this.viewer
          const viewerRadio = clientWidth / 2 / clientHeight
          const isOver = result.some(o => o > viewerRadio)
          this.pageFile = isOver ? pageFile.slice(0, 1) : pageFile
        })
      } else {
        this.pageFile = pageFile
      }
    },
    // 点击
    handleClick(event) {
      const { clientX } = event
      const viewWidth = this.viewer.clientWidth
      const radio = clientX / viewWidth
      if (radio < 0.33) {
        this.changePage('prev')
      } else if (radio < 0.66) {
        this.option = true
      } else {
        this.changePage('next')
      }
    },
    // 翻页
    changePage(type) {
      const oldInx = this.inx
      if (type === 'next') {
        this.inx = Math.min(this.files.length, this.inx + this.pageFile.length)
      } else {
        this.inx = Math.max(1, this.inx - this.pageFile.length)
      }
      if (oldInx !== this.inx) {
        this.$refs.comic.scrollTop = 0
      }
    },
    // 切换模式
    switchAdapt() {
      this.adapt = this.adapt === 'height' ? 'width' : 'height'
      this.$dataStore.set('adapt', this.adapt)
    },
    // 切换单/双页模式
    switchPage() {
      this.page = this.page === 1 ? 2 : 1
      this.setPageFile()
      this.$dataStore.set('page', this.page)
    }
  }
}
</script>
<style lang="less" scoped>
#comic {
  position: relative;
  width: 100vw;
  height: 100vh;
  .viewer {
    display: flex;
    justify-content: space-around;
    height: 100%;
    width: 100%;
    li {
      position: relative;
      img {
        display: block;
        margin: 0 auto;
      }
      .adapt-width {
        width: 100%;
        object-fit: cover;
        object-position: top center;
      }
      .adapt-height {
        height: 100%;
        object-fit: contain;
      }
    }
  }
  .center {
    li:first-child img {
      float: right;
    }
    li:last-child img {
      float: left;
    }
  }
  .mask {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
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
    left: 0;
    right: 0;
    .option-mask {
      position: absolute;
      width: 100%;
      height: 100%;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: absolute;
      left: 0;
      bottom: 0;
      padding: 0 12px;
      width: 100%;
      height: 50px;
      color: #fff;
      box-sizing: border-box;
      background-color: #b980ae;
      .slider {
        margin-right: 10px;
        height: 50px;
        flex: 1;
        display: flex;
        justify-content: space-between;
        align-items: center;
        > span {
          display: inline-block;
        }
        .progress {
          width: 80px;
          text-align: left;
        }
        .vue-slider {
          margin: 0 10px;
          flex: 1;
        }
      }
      .menu {
        height: 50px;
        display: flex;
        li {
          width: 100px;
          height: 50px;
          line-height: 50px;
          text-align: center;
        }
      }
    }
  }
}
</style>
