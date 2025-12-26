# 略缩图方案

## 问题描述

在 ComicLibrary 组件中，左边是漫画库，右边是指定漫画的图片列表。现在我发现每次切换漫画加载图片时，虽然我使用了虚拟dom,但是我发现还是有卡顿和不流畅的现象，我的每张图片大概2-5mb,每个漫画库200张图片，现在我使用了虚拟dom,实际只渲染 30 张图片，还是不流畅。

## 解决方案

用 Rust 生成缩略图。在 scan_comic_images 方法中，增加生成络缩图的逻辑。

### 络缩图尺寸

```
ThumbnailConfig {
    width: 256,          // Retina 完美显示
    height: 'auto',      // 自适应
    quality: 70,         // 性价比最高，生成快
    format: "jpeg",      // macOS 解码最快
    filter: Triangle,    // 速度与质量平衡
}
```

### 清理策略

启动应用时自动清理，清理策略如下：

```
{
  strategy: "lru",
  maxAgeDays: 30,      // 30 天未访问清理
  maxSizeMB: 1000MB,      // 1GB 缓存空间
}
```

✅ Scanned library with 3 comics in 7.10s

📚 Found 128 images
✅ Processed 128 images in 22.59s (176ms per image)
📚 Found 16 images
✅ Processed 16 images in 14.60s (912ms per image)
📚 Found 43 images
✅ Processed 43 images in 10.55s (245ms per image)
📚 Found 54 images
✅ Processed 54 images in 35.08s (650ms per image)

双栏两张图片的显示是正常了，但是前后切换页面还是有以下几个问题：

1. 如果当前双栏显示两张图片，当点击上一页，会跳过一张图片，显示上上张图片，因为上张和上上张图片都不支持双栏显示；
2. 如果当前双栏显示一张图片，当点击上一页，只显示了上张图片，但其实上张和上上张图片可以组成双栏显示；

现在我已经在 Image 结构中增加了 width 和 height 字段， 方便你提前进行计算
