# Library Store 性能优化方案 (Revised)

## 1. 核心目标 (Core Objectives)

在保持 `src-tauri/src/scanner.rs` 返回的原始数据结构不变的前提下，通过分离高频/低频状态和优化持久化策略，解决性能瓶颈。

## 2. 现状分析 (Analysis)

- **数据源**: 后端 Scanner 返回嵌套的 `Library[] -> (Authors[] -> Books[] | Comics[])` 结构。此结构不可变。
- **性能热点**:
  1.  **高频更新**: 阅读进度 (`progress`) 随用户滚动/翻页极高频触发。
  2.  **全量重写**: 阅读进度存储在 `Library` 对象树中，Zustand 的 `persist` 中间件在每次更新时序列化整个大对象树。
  3.  **引用变动**: 深层嵌套更新导致 Immer 产生新的对象引用，触发大量组件不必要的重渲染检查。

## 3. 优化实施方案 (Implementation Plan)

### 3.1 状态分离 (Split State) - 核心策略

将 **极高频变化的“阅读进度”** 从 **低频变化的“库元数据”** 中剥离。

- **LibraryStore (主库)**:
  - 存储: 所有的 `Library`, `Comic`, `Book` 数据，以及 `starred` (收藏) 状态。
  - 原因: `starred` 状态变更频率低，且涉及文件系统写入 (xattr)，适合留在主实体上。
  - 结构: 保持 Scanner 返回的嵌套结构，但内部可维护 `ID -> Reference` 的辅助映射以加速查找 (Optional)。

- **ProgressStore (进度库) [New]**:
  - 存储: `Record<ItemId, Progress>`。
  - 特点: 极致扁平，只存 ID 和进度对象。
  - 更新: 滚动时只更新此 Store，不触碰庞大的 LibraryStore。

```typescript
// 伪代码示例
interface ProgressState {
  // comicId/bookId -> Progress
  items: Record<
    string,
    {
      current: number
      total: number
      percent: number
      lastRead: number
    }
  >
  updateProgress: (id: string, progress: any) => void
}
```

### 3.2 持久化策略 (Persistence Strategy)

针对两个 Store 采用不同的策略：

1.  **LibraryStore**:
    - 使用 `IndexedDB` (现有方案)。
    - **优化**: 配置 `partialize` 忽略 `isScanning`, `comicImagesCache` 等不需要持久化的临时数据。

2.  **ProgressStore**:
    - 使用 `IndexedDB`。
    - **核心优化**: **Debounce (防抖) 写入**。
    - 阅读时内存状态 (`Zustand State`) 是实时更新的，保证 UI 响应无延迟。
    - 磁盘写入 (`Storage`) 延迟 1-5秒执行。如果用户快速翻页，不会连续触发 IDB 写入。

### 3.3 数据结构优化 (Data Access Optimization)

虽然不改变后端返回结构，但在前端 Store 初始化 (`setLibraries`) 时，可以构建 **辅助索引 (Auxiliary Indexes)**：

```typescript
// 在 Store 内部维护，不一定暴露给 state，或者作为 derived state
const comicIndex = new Map<string, Comic>()
const bookIndex = new Map<string, Book>()
```

这将 `findComic` / `findBook` 的时间复杂度从 `O(N)` 降低到 `O(1)`，且不破坏原始层级结构。

## 4. 实施步骤 (Roadmap)

### 阶段一：重构持久化与索引 (Foundation)

1.  **构建 Debounced Storage**: 实现一个支持防抖的 `storage` 适配器。
2.  **建立内部索引**: 修改 `useLibraryStore`，在 `addLibrary` / `updateLibrary` 时自动维护一个 `id -> item` 的查找表（可使用 `proxy-memoize` 或简单的 Map 缓存）。
3.  **优化 `find` 方法**: 重写 `findComic` / `findBook` 使用索引查找。

### 阶段二：分离进度状态 (Split Progress)

1.  **创建 `useProgressStore`**: 定义新的 Store 专门管理阅读进度。
2.  **迁移数据**: 在应用启动时，如果需要兼容旧数据，从 `LibraryStore` 读取进度迁移到 `ProgressStore` (如果决定彻底分离)。或者保持双向同步（不推荐，增加复杂性）。建议完全迁移。
3.  **修改组件**:
    - `ComicReader` / `BookReader`: 写入 `useProgressStore`。
    - `LibraryItem` / `Sidebar`: 从 `useProgressStore` 读取进度显示。

### 阶段三：清理主 Store

1.  从 `LibraryStore` 类型定义中移除 `progress` 字段 (可选，或者保留与其同步用于导出，但运行时UI不依赖它)。
2.  `starred` 状态保留在 `LibraryStore`，因为它是元数据的一部分。

## 5. 预期收益 (Expected Outcome)

- **阅读流畅度**: 翻页/滚动不再触发大对象序列化，消除卡顿。
- **内存占用**: 减少因 Immer 生成过多 Draft 对象导致的瞬时内存峰值。
- **响应速度**: 从库中查找书籍/漫画的速度提升至瞬时 (O1)。

---

_请确认此方案是否符合您的预期，确认后我将开始按阶段实施。_
