import React, { useRef } from 'react';
import ReactPlayer from 'react-player';
import { cn } from '@/lib/utils';

interface VideoPlayerProps {
  src: string;
  title?: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
}

// Define the progress state type based on react-player's actual callback
interface OnProgressState {
  played: number;
  playedSeconds: number;
  loaded: number;
  loadedSeconds: number;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  poster,
  className,
  autoPlay = false,
  controls = true,
  onTimeUpdate,
  onEnded,
}) => {
  const playerRef = useRef<ReactPlayer>(null);

  const handleProgress = (state: OnProgressState) => {
    if (onTimeUpdate && playerRef.current) {
      const duration = playerRef.current.getDuration();
      onTimeUpdate(state.playedSeconds, duration);
    }
  };

  return (
    <div className={cn('relative bg-black rounded-lg overflow-hidden', className)}>
      <ReactPlayer
        ref={playerRef}
        src={src}
        controls={controls}
        playing={autoPlay}
        width="100%"
        height="100%"
        onProgress={handleProgress as any}
        onEnded={onEnded}
        light={poster}
      />
    </div>
  );
};
