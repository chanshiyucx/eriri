你遇到的报错 `Error: Maximum update depth exceeded` 和 `The result of getSnapshot should be cached`，核心原因在于 **Zustand 的异步持久化（Async Persistence）与 React 的渲染周期发生了冲突**。

### 核心原因分析

1. **异步加载导致的“闪烁”**：
   你实现的 `createTauriFileStorage` 是异步的（`getItem` 返回 `Promise`）。这意味着应用启动时，Zustand **无法立即获取数据**，它会先使用你定义的默认状态（空的 `libraries`, `comics` 等）初始化 Store 并渲染 React 组件。
2. **水合（Hydration）触发更新**：
   几毫秒后，`read_store_data` 从 Rust 返回数据，Zustand 的 `persist` 中间件会调用 `set` 更新 Store。
3. **死循环陷阱**：
   React 检测到 Store 变化，触发组件重渲染。如果你的组件（比如截图中的 `ComicLibrary2`）在 `useEffect` 中依赖了这些状态，或者使用了**不稳定的 Selector**（例如返回新对象的 Selector），就会导致：
   `渲染 -> 水合完成 -> 状态更新 -> 重渲染 -> (触发某些副作用或 Selector 不稳定) -> 再次更新 -> 死循环`。

报错信息 `The result of getSnapshot should be cached` 强烈暗示了在数据加载过程中，Store 返回的状态对象引用在不断变化，导致 React 的 `useSyncExternalStore`（Zustand 内部使用）崩溃。

---

### 解决方案

要解决这个问题，最标准的方法是**“显式等待水合完成”**。我们需要告诉 React：“在从本地文件加载完数据之前，不要渲染核心业务组件”。

#### 第一步：修改 `library.ts`，增加水合状态标记

我们需要在 Store 中增加一个 `_hasHydrated` 标记，并利用 `persist` 中间件的 `onRehydrateStorage` 回调来控制它。

**修改 `src/store/library.ts`：**

```typescript
// ... existing imports

interface LibraryState {
  // 1. 新增一个状态标记
  _hasHydrated: boolean

  // ... existing state properties
  isScanning: boolean
  libraries: Record<string, Library>
  // ...
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    immer((set, get) => ({
      // 2. 初始化为 false
      _hasHydrated: false,

      isScanning: false,
      libraries: {},
      // ... existing implementation ...
    })),
    {
      name: 'library',
      storage: createJSONStorage(() => createTauriFileStorage('library')),

      // 3. 排除 _hasHydrated 不被持久化写入磁盘
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { isScanning, _hasHydrated, ...persistedState } = state
        return persistedState
      },

      // 4. 监听水合完成事件
      onRehydrateStorage: () => (state) => {
        // 当数据从 Rust 加载完毕后，设置标记为 true
        state?.set((s) => {
          // @ts-ignore: immer 可能会报类型错误，直接赋值即可
          s._hasHydrated = true
        })
      },
    },
  ),
)
```

#### 第二步：在 UI 层阻断渲染

在你的应用根组件（或者 `ComicLibrary2` 的父组件）中，检查这个标记。如果还没加载完，就显示 Loading 或返回 `null`，**避免未初始化的组件过早运行**。

```tsx
import { useLibraryStore } from '@/store/library'

export default function App() {
  // 获取水合状态
  const hasHydrated = useLibraryStore((state) => state._hasHydrated)

  // 🚨 关键：如果还没加载完文件，什么都不要渲染，或者渲染一个 Loading 骨架屏
  if (!hasHydrated) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading Library...
      </div>
    )
  }

  return (
    // 你的正常应用路由/布局
    <Layout />
  )
}
```

---

### 补充检查：Selector 稳定性

如果加上述修复后依然报错，请检查 `ComicLibrary2` 或其他组件中是否使用了**返回新对象**的 Selector。

**❌ 错误的写法（导致无限循环）：**

```typescript
// 每次渲染都会返回一个新的对象 { ... }，导致 React 认为状态变了
const { comics, videos } = useLibraryStore((state) => ({
  comics: state.comics,
  videos: state.videos,
}))
```

**✅ 正确的写法：**

```typescript
// 方法 B: 使用 useShallow (如果必须在一个 hook 里获取)
import { useShallow } from 'zustand/react/shallow'

// 方法 A: 分开获取（推荐）
const comics = useLibraryStore((state) => state.comics)
const videos = useLibraryStore((state) => state.videos)

const { comics, videos } = useLibraryStore(
  useShallow((state) => ({
    comics: state.comics,
    videos: state.videos,
  })),
)
```

### 总结

你遇到的是**异步存储的典型副作用**。IndexedDB（之前使用的）虽然也是异步，但可能因为加载速度或库的实现差异掩盖了这个问题。切换到 Tauri 文件读取后，异步间隙变明显了。通过添加 `_hasHydrated` 标记并延迟渲染，可以彻底解决这个问题。
