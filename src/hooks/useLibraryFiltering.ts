import { useMemo } from 'react'
import { Comic } from '@/types/library'
import { SortKey, SortOrder } from './useLibrarySearch'

interface UseLibraryFilteringProps {
  comics: Comic[]
  selectedLibraryId: string | null
  searchQuery: string
  sortKey: SortKey
  sortOrder: SortOrder
  showOnlyInProgress: boolean
}

export function useLibraryFiltering({
  comics,
  selectedLibraryId,
  searchQuery,
  sortKey,
  sortOrder,
  showOnlyInProgress,
}: UseLibraryFilteringProps) {
  const processedComics = useMemo(() => {
    let result = selectedLibraryId
      ? comics.filter((c) => c.libraryId === selectedLibraryId)
      : comics

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter((c) => c.title.toLowerCase().includes(query))
    }

    // Filter by reading progress (Continue Reading)
    if (showOnlyInProgress) {
      result = result.filter((c) => c.progress && c.progress.percent > 0)
    }

    // Ensure unique comics before sorting
    const unique = Array.from(new Map(result.map((c) => [c.id, c])).values())

    // Sort
    return unique.sort((a, b) => {
      let comparison = 0
      if (sortKey === 'name') {
        comparison = a.title.localeCompare(b.title, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      } else {
        comparison = (a.createdAt || 0) - (b.createdAt || 0)
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [
    comics,
    selectedLibraryId,
    searchQuery,
    sortKey,
    sortOrder,
    showOnlyInProgress,
  ])

  return processedComics
}
