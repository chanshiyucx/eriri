<template>
  <div id="list">
    <div class="open-folder" @click="openFolder">
      <svg-icon icon-class="folders" />
      <span>添加本地文件夹</span>
    </div>
    <ul>
      <li
        v-for="(item, i) in list"
        :key="item.path"
        :class="curInx === i && 'active'"
        @click="setCurInx(i)"
      >
        <span>
          <svg-icon icon-class="folder" />
          {{ item.name }}
        </span>
        <span class="path">{{ item.path }}</span>
        <span>
          <span>{{ item.comicCount }} 本漫画</span>
          <svg-icon @click="handleDelete(i)" icon-class="trash" />
        </span>
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
  name: 'list',
  data() {
    return {
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
        console.log('filePath', filePath, name)
        // 保存上次选择的文件夹
        this.selectFolder = filePath
        this.$dataStore.set('selectFolder', filePath)
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
    },
    // 删除目录
    handleDelete(i) {
      this.list.splice(i, 1)
    },
    // 设置当前展开目录
    setCurInx(i) {
      this.curInx = i
      this.$dataStore.set('curInx', this.curInx)
    }
  },
  // 进入首页
  gotoHome() {}
}
</script>
<style lang="less" scoped>
#list {
  .open-folder {
    cursor: pointer;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin: 150px auto 50px;
    width: 180px;
    height: 120px;
    border-radius: 3px;
    color: #eee;
    text-align: center;
    box-shadow: 0 3px 10px #333;
    background-color: #b980ae;
    svg {
      margin-bottom: 10px;
      font-size: 42px;
    }
  }
  ul {
    cursor: pointer;
    margin: 0 auto;
    width: 80%;
    color: #eee;
    border-radius: 3px;
    background-color: #222;
    overflow: hidden;
    li {
      display: flex;
      justify-content: space-between;
      padding: 0 12px;
      width: 100%;
      height: 48px;
      line-height: 48px;
      transition: background 0.25s ease-in-out;
      &:hover,
      &.active {
        background-color: #b980ae;
      }
      span {
        flex: 1;
        display: inline-block;
        text-align: left;
        svg {
          margin-right: 5px;
        }
      }
      span:last-child {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .path {
        flex: 3;
        color: #ccc;
      }
    }
  }
}
</style>
