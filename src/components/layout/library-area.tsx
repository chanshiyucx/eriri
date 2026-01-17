import { useLibraryStore } from '@/store/library'
import { LibraryType } from '@/types/library'
import { BookLibrary } from './book-library'
import { ComicLibrary } from './comic-library'
import { VideoLibrary } from './video-library'

export function LibraryArea() {
  const selectedLibrary = useLibraryStore((s) =>
    s.selectedLibraryId ? s.libraries[s.selectedLibraryId] : null,
  )

  if (!selectedLibrary) return null

  return (
    <main
      className="bg-surface flex-1 overflow-hidden"
      key={selectedLibrary.createdAt}
    >
      {selectedLibrary.type === LibraryType.book ? (
        <BookLibrary selectedLibrary={selectedLibrary} />
      ) : selectedLibrary.type === LibraryType.video ? (
        <VideoLibrary selectedLibrary={selectedLibrary} />
      ) : (
        <ComicLibrary selectedLibrary={selectedLibrary} />
      )}
    </main>
  )
}
