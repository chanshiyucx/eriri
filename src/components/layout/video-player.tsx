import { useLibraryStore } from '@/store/library'
import '@vidstack/react/player/styles/base.css'
import '@vidstack/react/player/styles/plyr/theme.css'
import { MediaPlayer, MediaProvider } from '@vidstack/react'
import {
  PlyrLayout,
  plyrLayoutIcons,
} from '@vidstack/react/player/layouts/plyr'

interface VideoPlayerProps {
  videoId: string
}

export function VideoPlayer({ videoId }: VideoPlayerProps) {
  const video = useLibraryStore((s) => s.videos[videoId])

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
        <PlyrLayout
          icons={plyrLayoutIcons}
          controls={[
            'play-large',
            'play',
            'progress',
            'current-time',
            'duration',
            'mute+volume',
            'settings',
          ]}
        />
      </MediaPlayer>
    </div>
  )
}
