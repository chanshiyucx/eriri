<template>
  <div id="list">
    <div class="open-folder">
      <button @click="openFolder">添加文件夹</button>
    </div>
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
  name: 'list',
  data() {
    return {
      selectFolder: '',
      list: []
    }
  },
  mounted() {
    this.selectFolder = this.$dataStore.get('selectFolder') || remote.app.getPath('userData')
  },
  methods: {
    // 打开目录
    openFolder() {
      options.defaultPath = this.selectFolder
      dialog.showOpenDialog(options, dir => {
        this.loading = true
        const filePath = dir[0]
        // 保存上次选择的文件夹
        this.selectFolder = filePath
        this.$dataStore.set('selectFolder', filePath)
        // 判断是否重复
        const inx = this.list.find(o => o.path === filePath)
        if (inx >= 0) return
        // 读取选中的目录
        fs.readdir(filePath, (err, files) => {
          if (err) {
            this.loading = false
            return
          }
          const comicList = []
          // 遍历目录下的文件列表
          files.forEach(filename => {
            const filedir = path.join(filePath, filename)
            const stat = fs.statSync(filedir)
            if (!stat.isDirectory()) return
            // 如果是文件夹且内含有图片则判断为漫画
            const comicFiles = fs.readdirSync(filedir).filter(isImg)
            const oneComic = { filename, filedir, comicFiles }
            comicList.push(oneComic)
          })
          if (comicList.length) {
            this.list.push({
              path: filePath,
              comicCount: comicList.length,
              comicList
            })
            this.$dataStore.set('list', this.list)
          }
          this.loading = false
        })
      })
    }
  },
  // 进入首页
  gotoHome() {}
}
</script>
