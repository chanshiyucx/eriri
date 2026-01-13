# macOS App Sandbox 权限持久化最佳实践方案

## 1. 问题背景

macOS App Sandbox 为了安全，限制应用访问用户文件系统。用户通过 `Dialog` 选择文件夹时，系统仅授予应用**从该时刻起、直到应用关闭**的临时访问权限。

应用重启后，即便保留了路径字符串（如 `/Users/xxx/Downloads/Lib`），再次尝试读取该路径（特别是使用 Rust 后端的 `std::fs`）时，会被操作系统拦截，导致 `Operation not permitted` 错误。

## 2. 核心机制：Security-Scoped Bookmarks

要解决此问题，必须使用 macOS 提供的 **Security-Scoped Bookmarks** 机制。

1.  **生成书签 (Create Bookmark)**: 当用户首次授权（选择文件夹）时，应用利用获得的临时权限，为该 URL 生成一个加密的 `BookmarkData` (NSData/Vec<u8>)。
2.  **持久化 (Persist)**: 将这个 base64 编码后的 BookmarkData 保存到应用的配置文件或数据库中（如 `store.json`）。
3.  **解析书签 (Resolve Bookmark)**: 应用每次启动时，读取保存的 BookmarkData，向系统请求“解析”该书签。如果系统验证通过，将重新授予应用对该 URL 的访问权限（将其纳入 Sandbox 的内核即时白名单）。

## 3. 推荐实施方案

鉴于你的项目使用 Tauri v2 + Rust 后端扫描文件，推荐在 **Rust 后端** 统一管理权限。

### 3.1 架构设计

新增一个 `ScopeManager` 模块，负责：

- 存储：维护 `path -> bookmark_base64` 的映射。
- 生命周期：在 App 启动 (`setup` 钩子) 时恢复所有书签。
- 接口：提供 `add_scope(path)` 命令供前端调用。

### 3.2 具体步骤

#### 第一步：添加依赖

在 `src-tauri/Cargo.toml` 中添加处理 macOS 书签的库和持久化存储库。

```toml
[target.'cfg(target_os = "macos")'.dependencies]
cocoa = "0.26"
objc = "0.2"
# 或者使用更封装的 crate，但直接调 API 更可控
```

_注：也可以使用 `tauri-plugin-store` 来存储书签数据，或者直接存普通 JSON 文件。_

#### 第二步：实现 Bookmark 管理逻辑 (Rust)

创建 `src-tauri/src/bookmark.rs` (示例伪代码)：

```rust
// 仅 macos 编译
#[cfg(target_os = "macos")]
mod macos {
    use cocoa::base::id;
    use cocoa::foundation::{NSURL, NSURLBookmarkCreationOptions, NSURLBookmarkResolutionOptions};

    // 生成书签
    pub fn create_bookmark(path: &str) -> Result<String, String> {
        // ... 调用 NSURL bookmarkDataWithOptions ...
        // 返回 base64 字符串
    }

    // 恢复权限
    pub fn resolve_bookmark(base64_data: &str) -> Result<String, String> {
        // ... 调用 NSURL URLByResolvingBookmarkData ...
        // startAccessingSecurityScopedResource()
        // 注意：解析成功后，不仅获得了 URL，系统也默默刷新了进程对该路径的权限
    }
}
```

#### 第三步：集成到应用生命周期

在 `src-tauri/src/lib.rs` 的 `setup` 闭包中：

```rust
.setup(|app| {
    // 1. 读取已保存的书签列表 (e.g. from app_data_dir/bookmarks.json)
    let bookmarks = load_bookmarks(app);

    // 2. 遍历并激活
    for (path, token) in bookmarks {
        #[cfg(target_os = "macos")]
        macos::resolve_bookmark(&token)?;
    }

    // ... 其他初始化
    Ok(())
})
```

#### 第四步：修改前端调用流程

在 `src/components/layout/sidebar.tsx` 的导入逻辑中，增加一步调用：

```typescript
// selectedPath 是用户刚刚选中的路径
await invoke('add_persistent_scope', { path: selectedPath })
// 然后再存入 library store
importLibrary(selectedPath)
```

对应的 Rust command `add_persistent_scope`:

1. 为该 path 生成 bookmark。
2. 保存到 `bookmarks.json`。

## 4. 方案优劣评估

| 特性             | 纯文件路径 (现状)     | 推荐方案 (Bookmark)                             |
| :--------------- | :-------------------- | :---------------------------------------------- |
| **重启后可用性** | ❌ 不可用             | ✅ 可用                                         |
| **实现复杂度**   | 低                    | 中 (需写一些 ObjC/Cocoa 绑定代码或用现成 Crate) |
| **系统兼容性**   | 仅非沙盒环境          | ✅ macOS Sandbox 标准方案                       |
| **用户体验**     | 差 (需频繁重新选目录) | 优 (无感)                                       |

## 5. 后续行动建议

1. 如果你同意此方案，我们可以先引入依赖，实现基础的 Bookmark 工具函数。
2. 然后创建一个简单的 `ScopeState` 来管理这些书签的保存与加载。
