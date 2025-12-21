你的问题是因为在 Tauri 应用中，浏览器/WebView **不允许直接使用本地文件系统的绝对路径**（如 `asset://localhost/.../pixiv/xxx.png`）作为 `<img src>` 的来源。这是一种安全限制，直接使用 file:// 或原始路径会报 “unsupported URL” 或 “Not allowed to load local resource”。

从截图和代码看，你的 `scanLibrary` 函数扫描漫画文件夹时，将封面图片的**本地绝对路径**直接存入了 `comic.cover`，然后在 `<img src={comic.cover}>` 中使用，导致加载失败。

### 需要特殊处理的点

是的，必须进行特殊处理。Tauri 提供了 **Asset Protocol** 来安全加载本地文件资源：

1. **转换路径**：使用 `@tauri-apps/api/core` 中的 `convertFileSrc` 函数，将本地文件路径转换为可加载的 URL（格式如 `asset:///path/to/file.png` 或 `https://asset.localhost/path/to/file.png`）。

2. **配置 Tauri**（在 `src-tauri/tauri.conf.json` 中）：
   - 对于 **Tauri v2**（推荐，当前主流）：
     ```json
     {
       "security": {
         "csp": "default-src 'self'; img-src 'self' asset: https://asset.localhost",
         "assetProtocol": {
           "enable": true,
           "scope": ["**"] // 允许所有路径（开发时可用，上线建议限制，如 ["$DOCUMENT/**"]）
         }
       }
     }
     ```
   - 对于 **Tauri v1**（旧版）：
     ```json
     {
       "tauri": {
         "allowlist": {
           "protocol": {
             "asset": true,
             "assetScope": ["**"]
           }
         },
         "security": {
           "csp": "default-src 'self'; img-src 'self' asset: https://asset.localhost"
         }
       }
     }
     ```

### 代码修改建议

在 `scanLibrary` 函数（或返回 comics 数据后）中，不要直接保存绝对路径，而是保存转换后的 URL。

示例修改（假设你用的是 `@tauri-apps/api`）：

```ts
import { convertFileSrc } from '@tauri-apps/api/core' // v2

// 或 import { convertFileSrc } from '@tauri-apps/api/tauri';  // v1

// 在 scanLibrary 中找到封面路径后：
const absoluteCoverPath = '/path/to/cover.png' // 你原来的路径
const coverUrl = convertFileSrc(absoluteCoverPath) // 转换为 asset:// 或 https://asset.localhost/...

// 然后存入 comic 对象
comic.cover = coverUrl
```

如果 `scanLibrary` 是 Rust 侧的命令，可以在 Rust 中返回绝对路径，然后在前端（React）收到 comics 数据后统一转换：

```tsx
// 在 ContentArea 或 useEffect 中
import { convertFileSrc } from '@tauri-apps/api/core'

const processedComics = comics.map((comic) => ({
  ...comic,
  cover: comic.cover ? convertFileSrc(comic.cover) : null,
}))
```

然后在渲染时直接用 `src={comic.cover}` 即可正常显示。

### 注意事项

- 转换后的 URL **只在 Tauri 打包后的应用中有效**，在纯浏览器 dev 模式下会失效（所以建议在 dev 时 fallback 到 placeholder）。
- 如果图片很多，建议加缓存或防抖，避免频繁转换。
- 安全考虑：上线时不要用 `"scope": ["**"]`，最好限制到用户导入的文件夹（如 `["$DOCUMENT/**"]` 或具体路径）。

处理完这些，导入文件夹后的漫画封面就能正常加载了。如果还有配置报错（如 403 Forbidden），检查 scope 是否包含了你的图片路径（尤其是 Linux 上隐藏文件夹需额外配置）。
