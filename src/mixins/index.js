import { remote } from 'electron'
import path from 'path'
import fs from 'fs'
import { isImg } from '@/utils'

const { dialog } = remote

// 打开文件夹参数
const options = {
  title: '选择文件夹',
  defaultPath: '',
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
      try {
        options.defaultPath = this.selectFolder
        dialog.showOpenDialog(options, dir => {
          const filePath = dir[0]

          // 保存上次选择的文件夹
          this.selectFolder = path.dirname(filePath)
          this.$dataStore.set('selectFolder', this.selectFolder)

          // 判断目录是否重复
          const inx = this.list.findIndex(o => o.path === filePath)
          if (inx >= 0) {
            this.$toasted.show('该目录已存在！', {
              position: 'top-center',
              className: 'toast',
              duration: 2000
            })
            return
          }

          // 读取选中的目录
          this.loading = true
          fs.readdir(filePath, (err, files) => {
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
              this.list.push({
                name: path.basename(filePath),
                path: filePath,
                comicCount: comicList.length,
                comicList
              })
              this.$dataStore.set('list', this.list)
            }
            this.loading = false
          })
        })
      } catch (error) {
        this.loading = false
      }
    }
  }
}
