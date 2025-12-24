// import { memo, useCallback } from 'react'
// import { BookReader } from '@/components/layout/BookReader'
// // Extracting Comic Reader to keep file clean
// import { useComicImagePreloader } from '@/hooks/useComicImagePreloader'
// import { useLibraryStore } from '@/store/library'
// import { useTabsStore, type Tab } from '@/store/tabs'
// import { Book, Comic } from '@/types/library'
// import { ComicDetailView } from './ComicDetail'

// interface TabContentProps {
//   tab: Tab
//   comic?: Comic
//   book?: Book
//   isActive: boolean
// }

// export const TabContent = memo(function TabContent({
//   tab,
//   comic,
//   book,
//   isActive,
// }: TabContentProps) {
//   const { updateTabState, setImmersive } = useTabsStore()
//   const { updateComicProgress, updateBookProgress } = useLibraryStore()

//   // -- handlers --

//   const handleScrollPositionChange = useCallback(
//     (scrollTop: number) => {
//       if (!isActive) return
//       // Debounce or just update? Zustand is fast, but let's trust the component to not spam.
//       // Actually ComicDetailView doesn't emit this yet. I need to update it.
//       updateTabState(tab.id, { scrollPosition: scrollTop })
//     },
//     [isActive, tab.id, updateTabState],
//   )

//   const handleStartReading = useCallback(
//     (index: number) => {
//       updateTabState(tab.id, { mode: 'read', readingPageIndex: index })
//       setImmersive(true)
//     },
//     [tab.id, updateTabState, setImmersive],
//   )

//   const handleExitReader = useCallback(() => {
//     updateTabState(tab.id, { mode: 'detail' })
//     setImmersive(false)
//   }, [tab.id, updateTabState, setImmersive])

//   const handleBookProgress = useCallback(
//     (progress: Omit<NonNullable<Book['progress']>, 'lastRead'>) => {
//       if (book) {
//         // updateBookProgress(book.id, {
//         //   startCharIndex: progress.startCharIndex,
//         //   totalChars: progress.totalChars,
//         //   percent: progress.percent,
//         // })
//       }
//     },
//     [book, updateBookProgress],
//   )

//   const handleComicProgress = useCallback(
//     (index: number, total: number) => {
//       if (comic) {
//         updateComicProgress(comic.id, index, total)
//       }
//     },
//     [comic, updateComicProgress],
//   )

//   // Render Reading Mode for Comic
//   if (tab.mode === 'read' && tab.type === 'comic') {
//     // For now, we reuse the Logic in ContentArea for the Reader Overlay?
//     // Or move it here?
//     // The original ContentArea had a global "isReading" state.
//     // Now each tab can be "isReading".
//     // We should render the Reader HERE.

//     // However, the Reader in ContentArea was using `useComicImagePreloader` which needs hooks.
//     // We can move that logic here or keep it simple.

//     // Let's defer Reader implementation to a sub-component or import it if it existed.
//     // It seems ContentArea implemented the Reader inline (div with img).
//     // I should probably extract that reader to `ComicReader.tsx` OR just render it here.

//     // For the first pass, I'll render a placeholder or the inline code if possible.
//     // But wait, the `useComicImagePreloader` hook needs to be used.

//     return (
//       <ComicReaderWrapper
//         tab={tab}
//         comic={comic}
//         onExit={handleExitReader}
//         onProgress={handleComicProgress}
//       />
//     )
//   }

//   // Render Detail View for Comic
//   if (tab.type === 'comic') {
//     return (
//       <ComicDetailView
//         comicPath={tab.path}
//         imageCount={tab.imageCount ?? comic?.pageCount ?? 0}
//         currentProgress={comic?.progress?.current}
//         onStartReading={handleStartReading}
//         initialScrollTop={tab.scrollPosition}
//         onScrollPositionChange={handleScrollPositionChange}
//       />
//     )
//   }

//   // Render Book Reader
//   if (tab.type === 'book' && book) {
//     return (
//       <BookReader
//         initialProgress={book.progress}
//         onExit={() => {
//           // Book reader exit usually goes back to home?
//           // Or just maybe we don't need 'onExit' if it's a tab?
//           // Original code: setActiveTab('home')
//           // If we are in a tab, maybe we don't exit?
//           // Actually usually BookReader IS the view.
//           // Asking to exit might mean closing the tab?
//         }}
//         onProgressUpdate={handleBookProgress}
//       />
//     )
//   }

//   return <div>Unknown Tab Type</div>
// })

// interface ComicReaderWrapperProps {
//   tab: Tab
//   comic?: Comic
//   onExit: () => void
//   onProgress: (index: number, total: number) => void
// }

// function ComicReaderWrapper({
//   tab,
//   onExit,
//   onProgress,
// }: ComicReaderWrapperProps) {
//   const { getCurrentImage } = useComicImagePreloader(
//     tab.path,
//     tab.readingPageIndex ?? 0,
//     tab.imageCount ?? 0,
//     2,
//   )

//   const currentImage = getCurrentImage()

//   // Simple navigation for now, can be improved
//   const handleNext = () => {
//     const next = (tab.readingPageIndex ?? 0) + 1
//     onProgress(next, tab.imageCount ?? 0)
//     useTabsStore.getState().updateTabState(tab.id, { readingPageIndex: next })
//   }

//   const handlePrev = () => {
//     const prev = (tab.readingPageIndex ?? 0) - 1
//     if (prev >= 0) {
//       onProgress(prev, tab.imageCount ?? 0)
//       useTabsStore.getState().updateTabState(tab.id, { readingPageIndex: prev })
//     }
//   }

//   // Keyboard support needs to be scoped or global?
//   // If we have multiple keep-alive readers, we only want the active one to respond.
//   // The parent controls mounting/display:none.
//   // But event listeners on window will fire for all.
//   // We should check `isActive` prop passed down if we were using window listeners.
//   // For now, let's assume `TabContent` is only mounted when alive.
//   // But `display: none` elements still exist.
//   // So we MUST check if we are visible.

//   // ... Doing the reader logic inline here is getting complex.
//   // I should probably reuse the logic from ContentArea or make a proper component.
//   // For this step I will assume there's a `ComicReader` component or similar.
//   // Since there isn't, I will basically copy the logic from ContentArea but make sure it respects visibility.

//   return (
//     <div
//       className="fixed inset-0 z-50 flex items-center justify-center bg-black"
//       onClick={(e) => {
//         const w = e.currentTarget.clientWidth
//         const x = e.clientX
//         if (x < w * 0.3) handlePrev()
//         else if (x > w * 0.7) handleNext()
//         else onExit()
//       }}
//     >
//       {currentImage ? (
//         <img
//           src={currentImage.url}
//           alt={currentImage.filename}
//           className="h-full w-full object-contain"
//           style={{ maxHeight: '100vh', maxWidth: '100vw' }}
//         />
//       ) : (
//         <div className="text-muted-foreground">Loading...</div>
//       )}
//     </div>
//   )
// }
