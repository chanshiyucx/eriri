import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useEffect, useEffectEvent, useRef } from 'react'
import { VirtuosoGrid } from 'react-virtuoso'
import { useShallow } from 'zustand/react/shallow'
import { VideoPlayer } from '@/components/layout/video-player'
import { Button } from '@/components/ui/button'
import { GridItem } from '@/components/ui/grid-item'
import { useCollapse } from '@/hooks/use-collapse'
import { openPathNative } from '@/lib/scanner'
import { cn } from '@/lib/style'
import { useLibraryStore } from '@/store/library'
import { useTabsStore } from '@/store/tabs'
import type { FileTags, Library, Video } from '@/types/library'

interface VideoItemProps {
  video: Video
  isSelected: boolean
  onClick: (id: string) => void
  onTags: (id: string, tags: FileTags) => Promise<void>
}

function VideoItem({ video, isSelected, onClick, onTags }: VideoItemProps) {
  return (
    <GridItem
      title={video.title}
      cover={video.cover}
      starred={video.starred}
      deleted={video.deleted}
      isSelected={isSelected}
      onClick={() => onClick(video.id)}
      onContextMenu={() => void openPathNative(video.path)}
      onStar={() => void onTags(video.id, { starred: !video.starred })}
      onDelete={() => void onTags(video.id, { deleted: !video.deleted })}
    />
  )
}

interface VideoLibraryProps {
  selectedLibrary: Library
}

export function VideoLibrary({ selectedLibrary }: VideoLibraryProps) {
  const sortedIdsCache = useRef<{ libraryId: string; videoIds: string[] }>({
    libraryId: '',
    videoIds: [],
  })

  const { collapsed, setCollapsed } = useCollapse()
  const updateLibrary = useLibraryStore((s) => s.updateLibrary)
  const updateVideoTags = useLibraryStore((s) => s.updateVideoTags)
  const activeTab = useTabsStore((s) => s.activeTab)

  const { videoId = '' } = selectedLibrary.status
  const video = useLibraryStore((s) => s.videos[videoId])
  const videos = useLibraryStore(
    useShallow((s) => {
      const videoIds = s.libraryVideos[selectedLibrary.id]

      if (sortedIdsCache.current.libraryId !== selectedLibrary.id) {
        const sortedIds = videoIds.toSorted((idA, idB) => {
          const a = s.videos[idA]
          const b = s.videos[idB]
          if (a.deleted !== b.deleted) return a.deleted ? 1 : -1
          if (a.starred !== b.starred) return a.starred ? -1 : 1
          return 0
        })
        sortedIdsCache.current = {
          libraryId: selectedLibrary.id,
          videoIds: sortedIds,
        }
      }

      return sortedIdsCache.current.videoIds.map((id) => s.videos[id])
    }),
  )

  const handleSelectVideo = (id: string) => {
    if (id === videoId) return
    updateLibrary(selectedLibrary.id, { status: { videoId: id } })
  }

  const renderVideoItem = (_index: number, video: Video) => (
    <VideoItem
      video={video}
      isSelected={videoId === video.id}
      onClick={handleSelectVideo}
      onTags={updateVideoTags}
    />
  )

  const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (activeTab || !video) return

    switch (e.code) {
      case 'KeyC':
        void updateVideoTags(video.id, { deleted: !video.deleted })
        break
      case 'KeyV':
        void updateVideoTags(video.id, { starred: !video.starred })
        break
    }
  })

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex h-full w-full">
      {/* Left Column: Video List */}
      <div
        className={cn(
          'flex shrink-0 flex-col',
          collapsed === 0 ? 'hidden' : 'flex-1',
          collapsed === 1 && 'border-r',
        )}
      >
        <div className="bg-base text-subtle flex h-8 items-center justify-between border-b px-3 text-xs">
          <div className="flex gap-2">
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
          <span>VIDEOS ({videos.length})</span>
        </div>
        <VirtuosoGrid
          className="flex-1"
          data={videos}
          itemContent={renderVideoItem}
          listClassName="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))]"
          increaseViewportBy={600}
        />
      </div>

      {/* Right Column: Video Player */}
      <div
        className={cn(
          'flex shrink-0 flex-col overflow-hidden',
          collapsed === 2 ? 'hidden' : 'flex-1',
        )}
      >
        <div className="bg-base text-subtle relative flex h-8 items-center justify-between border-b px-3 text-xs">
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

          <h3 className="absolute top-1/2 left-1/2 max-w-[60%] -translate-1/2 truncate text-center">
            {video?.title}
          </h3>
        </div>
        {video && <VideoPlayer videoId={video.id} />}
      </div>
    </div>
  )
}
