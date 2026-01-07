# 存储方案

在rust后端 src-tauri/src/config.rs 中提供用户选择缓存目录，用来存储图片略缩图。

前端的 src/store 中 zustand 数据持久化使用的是默认存储方案。

现在我希望 zustand 的数据持久化到用户选择的缓存目录。以达到两个核心目的：

1. 当缓存目录未设置或者不存在，app 启动后是默认初始的状态，界面干净。
2. 当用户选择不同的缓存目录时，app 启动加载缓存目录下的持久化数据，展示已导入的库。同时 src/components/layout/cache-info.tsx 中添加一个刷新按钮，重新载入库。
