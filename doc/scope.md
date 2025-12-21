### 我认为的最佳修复方案

基于 Tauri v2 官方文档（https://v2.tauri.app/plugin/persisted-scope/），最佳方案是集成 `tauri-plugin-persisted-scope` 插件。它会自动处理 dialog 选择的路径：

- 动态添加到 fs scope（允许 `readDir` 等访问子目录）。
- 持久化保存（JSON 文件在应用数据目录），重启后自动加载。
- 支持递归访问（子目录图片加载）。
- 安全：只限于用户选择的路径，不开放整个磁盘。

#### 步骤1: 安装插件

在你的 Tauri 项目根目录（src-tauri）运行：

```bash
cargo add tauri-plugin-persisted-scope
```

#### 步骤2: 初始化插件（Rust 侧）

在 `src-tauri/src/main.rs` 中，注册插件。**必须在 fs 插件之后初始化**：

```rust
use tauri_plugin_fs;  // 假设你已安装
use tauri_plugin_persisted_scope;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())  // 添加这一行
        // 其他插件和配置...
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

#### 步骤3: 修改前端导入逻辑（ContentArea.tsx）

在 `handleImport` 函数中使用 `open` 时，添加 `recursive: true` 以确保子目录也被 scope 覆盖：

```tsx
import { open } from '@tauri-apps/plugin-dialog'

const selected = await open({
  directory: true,
  multiple: false,
  recursive: true, // 关键：允许递归访问子目录
  title: 'Select Manga Library Folder',
})
```

- 无需额外代码：插件会自动检测 dialog 调用，扩展 fs scope，并持久化。
- 对于 asset protocol（图片加载），插件也会自动处理（确保你的 tauri.conf.json 已启用 assetProtocol，如之前建议）。

#### 步骤4: 配置 Capabilities（src-tauri/capabilities/main.json）

确保 fs 插件有基本读权限（插件会动态扩展 scope）：

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "productName": "your-app",
  "identifier": "com.your.app",
  "permissions": [
    "fs:default", // 基础 fs 权限
    "fs:allow-read-dir",
    "fs:allow-read-file",
    "dialog:allow-open"
  ]
}
```

- 无需静态添加路径；插件处理动态部分。

#### 步骤5: 测试和注意事项

- 运行 `tauri dev` 或构建应用。
- 首次导入：选择文件夹后，scope 立即生效，扫描子目录和加载图片（via `convertFileSrc`）正常。
- 重启应用：插件加载持久化 scope，继续工作。
- macOS 外部卷（如 `/Volumes`）：插件支持，无需额外配置。
- 如果有多个库：插件会累积所有选择的路径。
- 安全提示：上线前，检查 persisted-scope 的存储文件（通常在 `~/Library/Application Support/your-app`），确保不泄露敏感路径。
- 如果报错：检查控制台日志（插件会输出 scope 变化），或确认 fs 插件版本兼容（最新 v2）。

这个方案是最可靠的，因为它直接来自 Tauri 文档和社区（如 GitHub #8540：无插件需每次重选文件夹，有插件则持久化）。如果你的 Tauri 版本不是最新，建议升级到 v2.0+ 以确保兼容。如果还有问题，提供更多错误日志，我可以进一步调试。
