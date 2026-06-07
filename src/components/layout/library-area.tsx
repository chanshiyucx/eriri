import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'
import { useUIStore } from '@/store/ui'
import { LibraryType } from '@/types/library'
import { BookLibrary } from './book-library'
import { ComicLibrary } from './comic-library'

export function LibraryArea() {
  const selectedLibraryId = useUIStore((s) => s.selectedLibraryId)
  const isSidebarCollapsed = useUIStore((s) => s.isSidebarCollapsed)
  const selectedLibrary = useLibraryStore((s) =>
    selectedLibraryId ? s.libraries[selectedLibraryId] : null,
  )

  if (!selectedLibrary) return null

  return (
    <main
      className={cn(
        'bg-surface overflow-hidden md:block md:flex-1',
        isSidebarCollapsed ? 'block flex-1' : 'hidden',
      )}
      key={selectedLibrary.createdAt}
    >
      {selectedLibrary.type === LibraryType.book ? (
        <BookLibrary selectedLibrary={selectedLibrary} />
      ) : (
        <ComicLibrary selectedLibrary={selectedLibrary} />
      )}
    </main>
  )
}
