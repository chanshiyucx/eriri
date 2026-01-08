import { PanelLeftClose, PanelLeftOpen, Star, Trash2 } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { VideoPlayer } from '@/components/layout/video-player'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCollapse } from '@/hooks/use-collapse'
import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'
import { useTabsStore } from '@/store/tabs'
import { type FileTags, type Library, type Video } from '@/types/library'

interface VideoItemProps {
  index: number
  video: Video
  isSelected: boolean
  onClick: (id: string) => void
  onTags: (video: Video, tags: FileTags) => void
}

const VideoItem = memo(function VideoItem({
  index,
  video,
  isSelected,
  onClick,
  onTags,
}: VideoItemProps) {
  return (
    <div
      data-index={index}
      className={cn(
        'group flex w-[128px] shrink-0 cursor-pointer flex-col gap-1 rounded-sm p-1 transition-all',
        isSelected && 'bg-overlay ring-rose ring-2',
        video.deleted && 'opacity-40',
        video.starred ? 'bg-love/50' : 'hover:bg-overlay',
      )}
      onClick={() => onClick(video.id)}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm transition-all">
        <img
          src={video.cover}
          alt={video.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />

        <div className="absolute top-1.5 right-1.5 left-1.5 flex justify-between opacity-0 group-hover:opacity-100">
          <Button
            className="h-6 w-6 bg-transparent hover:bg-transparent"
            onClick={(e) => {
              e.stopPropagation()
              void onTags(video, { starred: !video.starred })
            }}
          >
            <Star
              className={cn(
                'text-love h-5 w-5',
                video.starred && 'fill-gold/80',
              )}
            />
          </Button>

          <Button
            className="h-6 w-6 bg-transparent hover:bg-transparent"
            onClick={(e) => {
              e.stopPropagation()
              void onTags(video, { deleted: !video.deleted })
            }}
          >
            <Trash2
              className={cn(
                'text-love h-5 w-5',
                video.deleted && 'fill-gold/80',
              )}
            />
          </Button>
        </div>
      </div>
      <div
        className={cn(
          'truncate text-center text-sm transition-colors',
          isSelected && 'text-love',
        )}
      >
        {video.title}
      </div>
    </div>
  )
})

interface VideoLibraryProps {
  selectedLibrary: Library
}

const EMPTY_ARRAY: string[] = []

export const VideoLibrary = memo(function VideoLibrary({
  selectedLibrary,
}: VideoLibraryProps) {
  const { collapsed, setCollapsed } = useCollapse()
  const updateLibrary = useLibraryStore((s) => s.updateLibrary)
  const updateVideoTags = useLibraryStore((s) => s.updateVideoTags)
  const activeTab = useTabsStore((s) => s.activeTab)

  const videoIds = useLibraryStore(
    (s) => s.libraryVideos[selectedLibrary.id] ?? EMPTY_ARRAY,
  )
  const videosMap = useLibraryStore((s) => s.videos)
  const videos = useMemo(
    () => videoIds.map((id) => videosMap[id]).filter(Boolean),
    [videoIds, videosMap],
  )

  const { videoId } = selectedLibrary.status
  const video = useLibraryStore((s) => (videoId ? s.videos[videoId] : null))

  const stateRef = useRef({ activeTab, video })
  // eslint-disable-next-line react-hooks/refs
  stateRef.current = { activeTab, video }

  const handleSetVideoTags = useCallback(
    (video: Video, tags: FileTags) => {
      void updateVideoTags(video.id, tags)
    },
    [updateVideoTags],
  )

  const handleSelectVideo = useCallback(
    (id: string) => {
      if (id === videoId) return
      updateLibrary(selectedLibrary.id, { status: { videoId: id } })
    },
    [selectedLibrary.id, updateLibrary, videoId],
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation()

      const { activeTab, video } = stateRef.current
      if (activeTab || !video) return

      const key = e.key.toUpperCase()
      if (key === 'C') {
        void handleSetVideoTags(video, { deleted: !video.deleted })
      } else if (key === 'V') {
        void handleSetVideoTags(video, { starred: !video.starred })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSetVideoTags])

  return (
    <div className="flex h-full w-full">
      {/* Left Column: Video List */}
      <div
        className={cn(
          'flex shrink-0 flex-col',
          collapsed === 0 ? 'w-0 border-none' : 'flex-1',
          collapsed === 1 && 'border-r',
        )}
      >
        <div className="bg-base text-subtle flex h-8 items-center justify-between border-b px-4 text-xs uppercase">
          <span>Videos ({videos.length})</span>
          <Button
            className="h-6 w-6"
            onClick={() => setCollapsed(collapsed === 1 ? 0 : 1)}
          >
            {collapsed === 0 ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>
        <ScrollArea className="h-0 flex-1">
          <div className="p-4">
            <div className="align-content-start grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] place-items-start gap-3">
              {videos.map((v, i) => (
                <VideoItem
                  key={v.id}
                  index={i}
                  video={v}
                  isSelected={videoId === v.id}
                  onClick={handleSelectVideo}
                  onTags={handleSetVideoTags}
                />
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Right Column: Video Player */}
      <div
        className={cn(
          'flex shrink-0 flex-col overflow-hidden',
          collapsed === 2 ? 'w-0' : 'flex-1',
        )}
      >
        <div className="bg-base text-subtle flex h-8 items-center justify-between border-b px-4 text-xs uppercase">
          <span>{video?.title}</span>
          <Button
            className="h-6 w-6"
            onClick={() => setCollapsed(collapsed === 1 ? 2 : 1)}
          >
            {collapsed === 2 ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </Button>
        </div>
        {video && <VideoPlayer videoId={video.id} />}
      </div>
    </div>
  )
})
