# Eriri 产品规划

## 产品背景

我是一名前端开发程序员，能够熟练使用 vue.js，react，node.js，tailwindcss，typescript 等主流技术栈。我想要开发一个在 macos 上运行的漫画与电子书阅读器。

## 核心功能

### 漫画阅读

- 直接导入本地的文件夹，假设我导入 Anti 文件夹的结构如下：

```
- Anti
    - Commic1
        - 1.jpg
        - 2.jpg
        - 3.jpg
    - Commic2
    - Commic3
    - Commic4
```

此时会创建一个 Anti 的库 library，里面包含 Commic1，Commic2，Commic3，Commic4 四个 commic，每个 commic 都是图片文件夹，里面全是图片，比如 jpg，png 等格式的图片文件，不是压缩包。

- 我的层级只有两层：库 library -> 漫画 commic
- 我的 commic 图片文件名默认已经排序好了
- 我可以导入多个文件夹作为不同的 library

### 电子书阅读

- 直接导入本地的文件夹，假设我导入 Books 文件夹的结构如下：

```
- Books
    - Book1.epub
    - Book2.epub
    - Book3.epub
```

此时会创建一个 Books 的库 library，里面包含 Book1，Book2，Book3 三个电子书，每个电子书都是 epub 文件。

- 我的层级只有两层：库 library -> 电子书 book
- 我可以导入多个文件夹作为不同的 library

## 功能设计

### 必要功能

- 只需考虑在 M 系列芯片 的 macos 系统运行，不需要考虑其他系统
- 非必要不缓存任何资源数据，比如漫画的图片，电子书的 epub 文件等，全部从文件系统读取
- 能够保存阅读进度，下次打开时能够从上次阅读的位置继续阅读
- 我的资源全部放在移动硬盘中，当移动硬盘被拔出时，我导入的 library 不会清除，只是无法访问，直到移动硬盘重新插上时，能够读取我原来导入的资源

### 可选功能

- 支持漫画 commic 和电子书 epub 收藏，收藏我希望直接使用 macos 的标签系统，对于漫画读取文件夹的标签，对于电子书读取文件的标签。假设我已经在 macos 创建了 “Like” 这个标签，我希望 Eriri 能读取这个标签，同时标签是双向同步的，即我可以在 Eriri 的界面中创建或移除标签，同时标签也会同步到 macos 的该文件夹或文件的标签中
