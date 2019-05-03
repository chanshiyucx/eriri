<template>
  <div id="home">
    <button @click="openFolder">选择文件夹</button>
    <ul class="comic-list">
      <li v-for="item in comicData" :key="item.filename">
        <img :src="item.coverData" alt />
        <div>{{ item.filename }} - {{ item.imgCount }}</div>
      </li>
    </ul>
  </div>
</template>

<script>
import { remote } from 'electron'
import mimeType from 'mime-types'
import path from 'path'
import fs from 'fs'

const { dialog } = remote

// 打开文件夹
const options = {
  title: '选择文件夹',
  defaultPath: remote.app.getPath('userData'),
  buttonLabel: '打开',
  properties: ['openDirectory']
}

export default {
  name: 'home',
  data() {
    return {
      loading: false,
      selectFolder: '',
      comicData: []
    }
  },
  mounted() {
    this.init()
  },
  methods: {
    // 初始化
    init() {
      this.comicData = this.loadData('comicData') || ''
      this.selectFolder =
        this.loadData('selectFolder') || remote.app.getPath('userData')
    },
    // 加载文件数据
    loadData(key) {
      this.$dataStore.get(key)
    },
    // 保存文件数据
    saveData(key, data) {
      this.$dataStore.set(key, data)
    },
    // 打开目录
    openFolder() {
      options.defaultPath = this.selectFolder
      dialog.showOpenDialog(options, dir => {
        this.loading = true
        const comicData = []
        const filePath = dir[0]
        // 保存上次选择的文件夹
        this.selectFolder = filePath
        this.saveData('selectFolder', filePath)
        // 读取选中的目录
        fs.readdir(filePath, (err, files) => {
          if (err) {
            this.loading = false
            return
          }
          // 遍历目录下的文件列表
          files.forEach(filename => {
            const filedir = path.join(filePath, filename)
            const stat = fs.statSync(filedir)
            if (!stat.isDirectory()) return
            // 如果是文件夹，则读取第一张图片作为封面
            const comicFiles = fs.readdirSync(filedir)
            const imgCount = comicFiles.length
            const oneComic = { filename, filedir, imgCount }
            const ext = ['.jpg', '.jpeg', '.png']
            for (let comic of comicFiles) {
              if (ext.includes(path.extname(comic))) {
                const coverPath = path.join(filedir, comic)
                const data = fs.readFileSync(coverPath)
                oneComic.coverPath = coverPath
                const fileMimeType = mimeType.lookup(coverPath)
                const prefix = `data:${fileMimeType};base64,`
                const base64 = Buffer.from(data).toString('base64')
                oneComic.coverData = `${prefix}${base64}`
                break
              }
            }
            comicData.push(oneComic)
          })
          this.loading = false
          this.comicData = comicData
          this.saveData('comicData', comicData)
        })
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
    padding: 0 10px;
    li {
      margin: 5px;
      padding: 4px;
      cursor: pointer;
      box-shadow: 0 2px 8px #ccc;
      transition: box-shadow 0.25s ease-in-out;
      &:hover {
        box-shadow: 0 2px 10px #b980ae;
      }
    }
    img {
      width: 140px;
      height: 220px;
      object-fit: cover;
    }
  }
}
</style>
