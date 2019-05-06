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
  name: 'mixin',
  data() {
    return {
      loading: false,
      selectFolder: '',
      list: [],
      curInx: 0
    }
  },
  mounted() {
    this.list = this.$dataStore.get('list') || []
    this.curInx = this.$dataStore.get('curInx') || 0
    this.selectFolder = this.$dataStore.get('selectFolder') || remote.app.getPath('userData')
  },
  methods: {
    // 打开目录
    openFolder() {
      options.defaultPath = this.selectFolder
      dialog.showOpenDialog(options, dir => {
        this.loading = true
        const filePath = dir[0]
        const name = path.basename(filePath)
        // 保存上次选择的文件夹
        const selectFolder = path.dirname(filePath)
        this.selectFolder = selectFolder
        this.$dataStore.set('selectFolder', selectFolder)
        // 判断是否重复
        const inx = this.list.findIndex(o => o.path === filePath)
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
            this.list.push({
              name,
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
  }
}
