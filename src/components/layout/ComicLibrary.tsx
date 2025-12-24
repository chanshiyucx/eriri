// import { ScrollArea } from '@/components/ui/scroll-area'
// import { useLibraryFiltering } from '@/hooks/useLibraryFiltering'
// import { useLibraryStore } from '@/store/library'
// import { Comic } from '@/types/library'

// interface ComicLibraryProps {
//   libraryId: string
//   searchQuery?: string
//   sortKey?: 'name' | 'date'
//   sortOrder?: 'asc' | 'desc'
//   showOnlyInProgress?: boolean
//   onComicClick: (comic: Comic) => void
// }

// export function ComicLibrary({
//   libraryId,
//   searchQuery = '',
//   sortKey = 'name',
//   sortOrder = 'asc',
//   showOnlyInProgress = false,
//   onComicClick,
// }: ComicLibraryProps) {
//   const { comics } = useLibraryStore()

//   const processedComics = useLibraryFiltering({
//     comics,
//     selectedLibraryId: libraryId,
//     searchQuery,
//     sortKey,
//     sortOrder,
//     showOnlyInProgress,
//   })

//   return (
//     <ScrollArea className="h-full w-full">
//       <div className="flex flex-wrap justify-start gap-6 p-6 pb-4">
//         {processedComics.map((comic) => (
//           <div
//             key={comic.id}
//             className="group flex w-[128px] shrink-0 cursor-pointer flex-col gap-2"
//             onClick={() => onComicClick(comic)}
//           >
//             <div className="bg-muted relative aspect-[2/3] w-full overflow-hidden rounded-sm shadow-md transition-all group-hover:scale-105 group-hover:shadow-xl">
//               {comic.cover ? (
//                 <img
//                   src={comic.cover}
//                   alt={comic.title}
//                   className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
//                   loading="lazy"
//                 />
//               ) : (
//                 <div className="bg-primary/5 flex h-full w-full items-center justify-center">
//                   <span className="text-primary/20 text-4xl font-bold">
//                     {comic.title[0]}
//                   </span>
//                 </div>
//               )}
//               <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
//                 <div className="text-[10px] font-medium text-white">
//                   {comic.progress && comic.progress.percent > 0
//                     ? `${Math.round(comic.progress.percent)}%`
//                     : '0%'}
//                 </div>
//                 <div className="text-[10px] font-medium text-white">
//                   {comic.pageCount ?? 0}P
//                 </div>
//               </div>

//               {/* Progress Bar */}
//               {comic.progress && comic.progress.percent > 0 && (
//                 <div className="bg-background/30 absolute inset-x-0 bottom-0 h-1">
//                   <div
//                     className="bg-primary h-full transition-all duration-300"
//                     style={{
//                       width: `${comic.progress.percent}%`,
//                     }}
//                   />
//                 </div>
//               )}
//             </div>
//             <div
//               className="text-foreground/90 group-hover:text-primary truncate text-sm font-medium transition-colors"
//               title={comic.title}
//             >
//               {comic.title}
//             </div>
//           </div>
//         ))}
//       </div>
//     </ScrollArea>
//   )
// }
