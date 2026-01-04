import { MediaPlayer, MediaProvider } from '@vidstack/react'
import {
  PlyrLayout,
  plyrLayoutIcons,
  type PlyrControl,
} from '@vidstack/react/player/layouts/plyr'
import { memo } from 'react'
import '@vidstack/react/player/styles/base.css'
import '@vidstack/react/player/styles/plyr/theme.css'
import { useLibraryStore } from '@/store/library'

const PLAYER_CONTROLS: PlyrControl[] = [
  'play-large',
  'play',
  'progress',
  'current-time',
  'duration',
  'mute+volume',
  'settings',
]

interface VideoPlayerProps {
  videoId: string
}

export const VideoPlayer = memo(function VideoPlayer({
  videoId,
}: VideoPlayerProps) {
  const video = useLibraryStore((s) => s.videos[videoId])

  if (!video) return null

  return (
    <div className="flex h-full w-full flex-1 items-center justify-center">
      <MediaPlayer
        title={video.title}
        src={video.url}
        poster={video.cover}
        autoPlay={true}
        className="h-full max-h-full max-w-full [&_video]:!h-full"
      >
        <MediaProvider />
        <PlyrLayout icons={plyrLayoutIcons} controls={PLAYER_CONTROLS} />
      </MediaPlayer>
    </div>
  )
})
