import { useState } from 'react'

export type SortKey = 'name' | 'date'
export type SortOrder = 'asc' | 'desc'

export function useLibrarySearch() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchVisible, setIsSearchVisible] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [isSortVisible, setIsSortVisible] = useState(false)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortOrder('asc')
    }
    // Keep sort menu open or close it? Originally it stayed open or user clicked away.
    // The original code passed `toggleSort` to the UI.
  }

  return {
    searchQuery,
    setSearchQuery,
    isSearchVisible,
    setIsSearchVisible,
    sortKey,
    setSortKey,
    sortOrder,
    setSortOrder,
    isSortVisible,
    setIsSortVisible,
    toggleSort,
  }
}
