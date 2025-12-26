# Library Store 性能优化分析方案

## 1. 现状深入分析 (Deep Analysis)

经过对 `src/store/library.ts` 及项目整体引用的分析，当前 Store 实现主要存在以下特征与潜在瓶颈：

### 1.1 数据结构 (Data Structure)

目前采用 **深层嵌套数组 (Deeply Nested Arrays)** 结构：

```typescript
Library[] -> Authors[] -> Books[]
          -> Comics[]
```

- **查找复杂度**: 所有的查找操作（`findComic`, `findBook`）都需要遍历数组，时间复杂度为 `O(N)`。随着库中书籍/漫画数量增加，性能会线性下降。
- **更新开销**: 使用 `immer` 虽然简化了不可变数据的更新逻辑，但在深层嵌套结构中，修改底层的 `progress` 或 `starred` 属性仍需要产生从根节点到叶子节点的全新引用路径，这在数据量大时会有一定开销。

### 1.2 持久化机制 (Persistence)

使用 `createIDBStorage` (IndexedDB) 进行全量状态持久化。

- **高频写入瓶颈**: 阅读进度的更新（`updateComicProgress`, `updateBookProgress`）即使是节流的，也会触发 Zustand 的 `persist` 中间件。默认情况下，每次状态变更（即使是极其微小的进度变化）都会触发整个 `libraries` 数组及其所有子对象的序列化和 IndexedDB 写入。
- **序列化成本**: `libraries` 数组如果包含成千上万条目，`JSON.stringify` 的成本极高，且会阻塞主线程（尽管 IndexedDB 是异步的，但序列化通常在主线程发生）。

### 1.3 状态粒度与选择器 (Granularity & Selectors)

- **全量订阅风险**: 如果组件使用 `useLibraryStore(state => state.libraries)`，那么任何一个库、任何一本书的任何属性变化，都会导致由于引用变动而触发组件重渲染。
- **衍生数据计算**: `findComic` 等方法挂载在 Store 上，每次调用都会重新遍历数组。

---

## 2. 优化方案 (Optimization Proposals)

为了达到极致性能，建议从以下几个维度进行优化：

### 方案一：数据结构扁平化与标准化 (Normalization) **[推荐]**

将嵌套结构改为 ID 索引的扁平化结构 (Normalized Structure)。

**Before:**

```typescript
interface Library {
  id: string
  comics: Comic[]
  // ...
}
```

**After (Proposed):**

```typescript
interface LibraryState {
  libraries: Record<string, LibraryMetadata>
  comics: Record<string, Comic> // Keyed by comicId
  books: Record<string, Book> // Keyed by bookId
  // 关联关系使用 ID 数组存储
  libraryComics: Record<string, string[]> // libraryId -> comicId[]
}
```

- **收益**:
  - **O(1) 查找**: 无论数据量多大，通过 ID 获取对象瞬间完成。
  - **精准更新**: 更新某本漫画的进度，只会改变 `comics` 记录中该 ID 对应的引用，不会波及 `libraries` 数组结构，大幅减少 Immer 的 Proxy 追踪开销。

### 方案二：分离易变状态 (Split Volatile State)

阅读进度（Progress）是高频更新数据，而元数据（Metadata，如标题、作者、封面）是低频更新数据。将它们分离：

```typescript
// Store 1: Metadata (Low frequency, heavy structure)
interface LibraryMetadataState {
  libraries: Library[]
  // operations...
}

// Store 2: UserData (High frequency, flat structure)
interface UserProgresState {
  comicProgress: Record<string, ComicProgress>
  bookProgress: Record<string, BookProgress>
  starredItems: Record<string, boolean>
}
```

- **收益**: 阅读时的高频进度更新只会触发 `UserProgresState` 的变更，完全隔离了庞大的 `LibraryMetadataState`。这避免了每次翻页都序列化整个 Library 树。

### 方案三：持久化策略优化 (Persistence Strategy)

针对 `persist` 中间件进行调优，避免高频写入阻塞。

1.  **Partialize (部分持久化)**:
    只持久化必要字段。例如 `isScanning` 不需要持久化。
    ```typescript
    persist(..., {
      partialize: (state) => ({ libraries: state.libraries, comicImagesCache: state.comicImagesCache }),
    })
    ```
2.  **Debounce Storage (防抖写入)**:
    即使状态更新了，也可以延迟写入 IndexedDB。可以实现一个自定义的 `storage` 包装器，对 setItem 进行 `debounce` 处理（例如 1000ms 或 5000ms 写入一次），大幅减少磁盘 IO 和序列化开销。

### 方案四：选择器与渲染优化 (Selector Optimization)

在组件层面，强制实施细粒度选择和浅层比较。

- **使用 `useShallow`**:

  ```typescript
  import { useShallow } from 'zustand/react/shallow'

  // 仅当 id 或 name 变化时渲染，忽略内部 comics 数组变化
  const { id, name } = useLibraryStore(
    useShallow((state) => ({
      id: state.libraries[0]?.id,
      name: state.libraries[0]?.name,
    })),
  )
  ```

- **原子化选择器**:
  不要在组件中 `const library = useStore(s => s.getLibrary(id))`，因为这通常返回整个对象。而是创建专门的 hook 如 `useComicProgress(comicId)` 只订阅进度字段。

---

## 3. 实施路线图 (Implementation Roadmap)

考虑到“尽量不破坏功能”的前提，激进的数据标准化（方案一）改动较大。我建议采用 **"方案三 (持久化优化)" + "方案二 (逻辑分离 - 这里的逻辑分离指内部状态分离)"** 的混合轻量级路径：

1.  **第一步：优化持久化 (最为紧迫)**
    - 为 `createJSONStorage` 增加 Debounce 机制。
    - 配置 `partialize` 排除 `isScanning` 和显式不需持久化的临时状态。

2.  **第二步：内部查找 Map 化 (无需重构 API)**
    - 虽然对外保持 `Library[]` 结构不变以兼容现有组件，但在 Store 内部维护 `Map<Id, Reference>` 缓存。
    - 或者，在 `get` 方法中，利用 `computed` 概念（Zustand 本身无 computed，但可以通过 getter 优化）或简单的 Memoization 优化查找。
    - _但在 Zustand 中，最好的方式是数据源头就是 Map。如果不改数据结构，则跳过此步，直接通过选择器优化。_

3.  **第三步：重构 `update` 逻辑**
    - 修改 `updateComicProgress` 等高频方法。目前它们使用 `find` 遍历。
    - 优化为：虽然数据结构是数组，但如果必须保持数组，我们在 `Library` 对象上也许无法直接优化 `O(N)`，除非引入辅助 Map。
    - **折中方案**: 保持 `Library[]` 结构，但对于 `Item` 的查找，仅在初始化或 Library 变更时构建一次 `Id -> Index` 的映射表（可在组件层用 `useMemo` 做，或在 Store 外部维护一个索引缓存）。

## 4. 推荐的最终建议 (Recommendation)

**主要建议**: 保持现有数据结构不变（为了兼容性），但**实现自定义的 Debounced Storage** 和 **细粒度选择器模式**。

如果允许小范围重构结构，**强烈建议将 `libraries` 内部的 `comics`, `authors` 数组改为 `Map` 或 `Record`**，这是性能提升的根源。

---

_待您审查后，我们可以决定具体实施哪一项优化。_
