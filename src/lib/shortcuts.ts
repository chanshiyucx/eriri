// Single source of truth for keyboard shortcuts. Values are `KeyboardEvent.code`
// (layout-independent). Every handler ignores meta/ctrl/alt combos.

export const SHORTCUTS = {
  // Global — tab bar & layout
  toggleImmersive: 'Space',
  closeTab: 'KeyX',
  toggleSidebar: 'KeyS',
  toggleMiddlePanel: 'KeyD',
  prevTab: 'ArrowUp',
  nextTab: 'ArrowDown',

  // Reading — comic & book readers / library
  continueReading: 'KeyP',
  toggleViewMode: 'KeyB',
  toggleToc: 'KeyT',
  toggleItemDeleted: 'KeyC',
  toggleItemStarred: 'KeyV',
  toggleImageDeleted: 'KeyN',
  toggleImageStarred: 'KeyM',

  // Image preview navigation
  prevImage: 'ArrowLeft',
  nextImage: 'ArrowRight',
} as const
