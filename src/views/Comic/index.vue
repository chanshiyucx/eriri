<template>
  <div id="comic">
    <Loading v-show="loading" />
    <ul class="viwer" @click="handleClick">
      <li
        v-for="item in pageFile"
        :key="item.filename"
        :style="{
          width: pageFile.length === 1 ? '100%' : '50%'
        }"
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
        <ul class="menu">
          <li @click="switchAdapt">
            <svg-icon
              :icon-class="adapt === 'height' ? 'rowExpand' : 'columnExpand'"
            />
            {{ adapt === 'height' ? '适应宽度' : '适应高度' }}
          </li>
          <li @click="switchPage">
            <svg-icon :icon-class="page === 1 ? 'doublepage' : 'singlepage'" />
            {{ page === 1 ? '双页模式' : '单页模式' }}
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
      pageFile: [],
      inx: 0, // 当前索引
      page: 1, // 单页或者双页模式
      adapt: 'height' // 适应高度or宽度
    }
  },
  computed: {
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
  watch: {
    inx(val) {
      this.setPageFile(val)
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
        this.setPageFile(0)
        this.loading = false
      })
    },
    setPageFile(val) {
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
          const viwer = document.querySelector('.viwer')
          const { clientWidth, clientHeight } = viwer
          const viwerRadio = clientWidth / 2 / clientHeight
          const isOver = result.some(o => o > viwerRadio)
          this.pageFile = isOver ? pageFile.slice(0, 1) : pageFile
        })
      } else {
        this.pageFile = pageFile
      }
    },
    // 点击
    handleClick(event) {
      const { clientX } = event
      const viewWidth = document.querySelector('.viwer').clientWidth
      const radio = clientX / viewWidth
      if (radio < 0.33) {
        this.inx = Math.max(0, this.inx - this.page)
      } else if (radio < 0.66) {
        this.option = true
      } else {
        this.inx = Math.min(this.files.length - 1, this.inx + this.page)
      }
    },
    // 切换模式
    switchAdapt() {
      this.adapt = this.adapt === 'height' ? 'width' : 'height'
    },
    // 切换单/双页模式
    switchPage() {
      this.page = this.page === 1 ? 2 : 1
      this.setPageFile(this.inx)
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
      background-color: #f2c047;
      .slider {
        height: 50px;
        flex: 1;
        display: flex;
        justify-content: space-between;
        align-items: center;
        > span {
          display: inline-block;
          width: 40px;
        }
        .vue-slider {
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
