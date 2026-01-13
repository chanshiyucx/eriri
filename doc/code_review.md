# 代码审查与分析报告

## 1. 总体评价

你已完成了 macOS Security-Scoped Bookmarks 的全栈实现流程，代码结构清晰，涵盖了：

- **前端**：Store 中增加了 `bookmark` 字段，并在 rehydrate 时尝试恢复。
- **后端**：新增 `bookmark.rs` 模块，通过调用外部 Swift 可执行文件来处理书签逻辑。
- **风格**：前端 TS 和后端 Rust 代码风格基本符合规范，命名清晰。

## 2. 🚨 关键架构缺陷 (Critical)

**目前的实现无法解决问题。**

### 原因分析：进程隔离 (Process Isolation)

macOS 的 App Sandbox 权限是授予**当前进程**的。

- 你目前的实现是使用 `std::process::Command` 启动一个子进程 (`src-tauri/swift/bookmark`) 来执行 `resolve` 操作。
- 当 `bookmark` 子进程调用 `URLByResolvingBookmarkData` 时，macOS 内核会将访问权限授予**该子进程**。
- **主进程 (Eriri App) 并没有获得权限**。
- 因此，当主进程中的 `scanner/book.rs` 尝试使用 `std::fs::read_dir` 读取目录时，依然会被 Sandbox 拦截。

### 结论

**必须在主进程 (Rust) 内部直接调用 macOS API** 来解析书签，而不能通过外部子进程辅助。

## 3. 代码规范合规性检查

对照 `rust.md` 规则：

- **[符合] 不改变现有功能与对外行为**: 没有破坏原有逻辑。
- **[符合] 修改范围**: 保持了局部修改。
- **[符合] 命名与风格**: 符合 Rust 习惯。
- **[不符合 / 需要权衡] 不引入新的第三方依赖**:
  - 你为了遵守此规则，选择了调用外部 Swift 二进制文件。
  - **代价**: 导致了上述的架构缺陷，功能不可用。
  - **建议**: 为了实现特定系统功能 (macOS Sandbox)，引入 `cocoa` 或 `objc` 等库是必要的且符合工程实践的（只要不引入庞大的无关框架）。

## 4. 改进建议

### 4.1 核心修复方案

需要在 `bookmark.rs` 中使用 Rust 的 FFI (Foreign Function Interface) 直接调用 macOS `Foundation` 框架。

由于手动写 `extern "C"` 绑定非常繁琐且容易出错（涉及 Objective-C Runtime），**强烈建议申请引入 `cocoa` 和 `objc` crate**。

### 4.2 推荐代码实现 (伪代码)

```toml
# Cargo.toml
[target.'cfg(target_os = "macos")'.dependencies]
cocoa = "0.25"
objc = "0.2"
block = "0.1"
```

```rust
// bookmark.rs
use cocoa::base::{id, nil};
use cocoa::foundation::{NSData, NSURL, NSURLBookmarkCreationOptions, NSURLBookmarkResolutionOptions};
use objc::{msg_send, sel, sel_impl};
use objc::runtime::{Object, BOOL};

pub fn resolve_bookmark_impl(bookmark_base64: &str) -> Result<String, String> {
    // 1. Decode base64 to NSData
    // 2. Call [NSURL URLByResolvingBookmarkData:...]
    // 3. Call [url startAccessingSecurityScopedResource]
    // 4. Return path
}
```

### 4.3 前端优化

`src/store/library.ts` 中 `onRehydrateStorage` 的 `restoreBookmarks` 调用没有处理并发量。如果库很多，可能会瞬间发起大量 IPC 调用。虽不是致命问题，但建议后续优化（例如批量处理）。

## 5. 下一步行动

1.  **申请权限**: 允许引入 `cocoa` 和 `objc` 依赖。
2.  **重构后端**: 废弃 `src-tauri/swift/bookmark` 方案，改用 Rust Native 实现。
