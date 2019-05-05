<template>
  <div id="home">
    <button @click="openFolder">选择文件夹</button>
    <ul class="comic-list">
      <li v-for="item in comicData" :key="item.filename" @click="gotoViwer(item)">
        <img :src="item.coverPath" :alt="item.coverName" />
        <div class="info">
          <h3>{{ item.filename }}</h3>
          <div class="meta">
            {{ item.progress >= 0 ? `${item.progress + 1}/${item.imgCount}` : '未读' }}
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script>
import { remote } from 'electron'
import path from 'path'
import fs from 'fs'
import { isImg } from '@/utils'

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
      this.comicData = this.$dataStore.get('comicData') || ''
      this.selectFolder = this.$dataStore.get('selectFolder') || remote.app.getPath('userData')
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
        this.$dataStore.set('selectFolder', filePath)
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
            for (let comic of comicFiles) {
              if (isImg(comic)) {
                const coverPath = path.join(filedir, comic)
                oneComic.coverPath = coverPath
                oneComic.coverName = comic
                break
              }
            }
            // 如果没有图片，则排除该文件夹
            if (!oneComic.coverPath) return
            comicData.push(oneComic)
          })
          this.loading = false
          this.comicData = comicData
          this.$dataStore.set('comicData', comicData)
        })
      })
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
  button {
    float: left;
    margin-top: 30px;
  }
  .comic-list {
    display: flex;
    flex-wrap: wrap;
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
