<template>
  <div id="app" ref="app">
    <Loading v-show="loading" />
    <Header :hideMenu="hideMenu" />
    <Menu v-show="!hideMenu" />
    <keep-alive :exclude="['Comic']">
      <router-view
        class="main scroll"
        :list="list"
        :curInx="curInx"
        @openFolder="openFolder"
        @loadComic="loadComic"
        @removeFolder="removeFolder"
        @setCurInx="setCurInx"
        @setList="setList"
      />
    </keep-alive>
  </div>
</template>

<script>
import { ipcRenderer, remote } from 'electron'
import path from 'path'
import fs from 'fs'
import Loading from '@/components/Loading'
import Header from '@/components/Header'
import Menu from '@/components/Menu'
import { isImg } from '@/utils'

const { dialog } = remote

const options = {
  title: '选择文件夹',
  defaultPath: '',
  buttonLabel: '打开',
  properties: ['openDirectory']
}

const delay = time => new Promise(r => setTimeout(r, time))

export default {
  name: 'app',
  components: {
    Loading,
    Header,
    Menu
  },
  data() {
    return {
      hideMenu: false,
      loading: false,
      selectFolder: '',
      list: [],
      curInx: 0
    }
  },
  watch: {
    $route(val) {
      this.hideMenu = val.name === 'comic'
    }
  },
  mounted() {
    this.list = this.$dataStore.get('list') || []
    this.curInx = this.$dataStore.get('curInx') || 0
    this.selectFolder = this.$dataStore.get('selectFolder') || remote.app.getPath('userData')

    // 注册键盘监听事件
    window.addEventListener('keydown', this.keydown)
  },
  beforeDestroy() {
    window.removeEventListener('keydown', this.keydown)
  },
  methods: {
    // 移除目录
    removeFolder(i) {
      this.list.splice(i, 1)
    },
    // 设置首页索引
    setCurInx(i) {
      this.curInx = i
      this.$dataStore.set('curInx', this.curInx)
    },
    // 设置首页列表
    setList(list) {
      this.list = list
      this.$dataStore.set('list', list)
    },
    // 打开目录
    openFolder() {
      try {
        options.defaultPath = this.selectFolder
        dialog.showOpenDialog(options, dir => {
          const filePath = dir[0]
          // 保存默认选择的文件夹
          this.selectFolder = path.dirname(filePath)
          this.$dataStore.set('selectFolder', this.selectFolder)
          // 判断目录是否重复
          const inx = this.list.findIndex(o => o.path === filePath)
          if (inx >= 0) return

          this.loadComic(filePath)
        })
      } catch (error) {
        this.loading = false
      }
    },
    // 加载漫画
    loadComic(filePath) {
      const startTime = +new Date()

      // 读取选中的目录
      this.loading = true
      fs.readdir(filePath, async (err, files) => {
        if (err) {
          this.loading = false
          return
        }

        const comicList = []
        // 遍历目录下的文件列表
        files.forEach(filename => {
          const filedir = path.join(filePath, filename)

          // 判断是否为文件夹
          const stat = fs.statSync(filedir)
          if (!stat.isDirectory()) return

          // 判断文件夹内是否有图片
          const comicFiles = fs.readdirSync(filedir).filter(isImg)
          if (!comicFiles.length) return

          const coverName = comicFiles[0]
          const coverPath = path.join(filedir, coverName)
          const oneComic = {
            filename,
            filedir,
            coverName,
            coverPath,
            imgCount: comicFiles.length
          }
          comicList.push(oneComic)
        })

        if (comicList.length) {
          // 判断是刷新还是新增
          const inx = this.list.findIndex(o => o.path === filePath)
          if (inx >= 0) {
            // 刷新保存原来进度
            const oldList = this.list[inx].comicList
            comicList.forEach(o => {
              const comic = oldList.find(c => c.filedir === o.filedir)
              if (comic && comic.progress) {
                o.progress = comic.progress
              }
            })
            this.list[inx].comicList = comicList
            this.list[inx].comicCount = comicList.length
          } else {
            this.list.push({
              name: path.basename(filePath),
              path: filePath,
              comicCount: comicList.length,
              comicList
            })
          }
          this.$dataStore.set('list', this.list)
        }
        const endTime = +new Date()
        const time = 1000 - (endTime - startTime)
        if (time > 100) {
          await delay(time)
        }

        this.loading = false
      })
    },
    keydown({ keyCode }) {
      switch (keyCode) {
        case 123: // F12
          this.toggleDevTools()
          break
        default:
          break
      }
    },
    toggleDevTools() {
      ipcRenderer.send('toggle-devtools')
    }
  }
}
</script>

<style lang="less">
#app {
  display: flex;
  justify-content: flex-start;
  width: 100vw;
  height: 100vh;
  background-color: #444;
  .main {
    overflow-y: auto;
  }
}
</style>
