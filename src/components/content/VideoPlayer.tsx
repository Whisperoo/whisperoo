import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  SkipBack, 
  SkipForward,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
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

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  title,
  poster,
  className,
  autoPlay = false,
  controls = true,
  onTimeUpdate,
  onEnded,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [bufferedPercentage, setBufferedPercentage] = useState(0);

  const hideControlsTimeout = useRef<NodeJS.Timeout>();

  // Auto-hide controls
  const resetControlsTimer = () => {
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    setShowControls(true);
    if (isPlaying) {
      hideControlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  // Reset state when src changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsLoading(true);
    setIsBuffering(false);
    setHasError(false);
    setErrorMessage('');
    setShowControls(true);
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    console.log('VideoPlayer initialized with src:', src);

    // Timeout fallback - if video doesn't load in 5 seconds, show play button anyway
    const loadingTimeout = setTimeout(() => {
      console.warn('Video loading timeout - showing controls anyway');
      setIsLoading(false);
    }, 5000);

    const handleLoadedMetadata = () => {
      console.log('Video loaded successfully:', src);
      clearTimeout(loadingTimeout);
      setDuration(video.duration);
      setIsLoading(false);
      setHasError(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime, video.duration);

      // Update buffered percentage
      if (video.buffered.length > 0 && video.duration > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const percentage = (bufferedEnd / video.duration) * 100;
        setBufferedPercentage(percentage);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };

    const handleWaiting = () => {
      console.log('Video waiting/buffering...');
      setIsBuffering(true);

      // Pause playback while buffering to prevent stuttering
      if (!video.paused) {
        console.log('Pausing playback during buffer...');
        video.pause();
      }

      // When video is waiting, check if we need to resume buffering
      // The browser may have suspended loading prematurely
      if (video.networkState === video.NETWORK_IDLE) {
        console.log('Network idle detected - requesting more data');
        // Trigger a small seek to wake up the network loading
        const currentTime = video.currentTime;
        video.currentTime = currentTime + 0.1;
        video.currentTime = currentTime;
      }
    };
    const handleCanPlay = () => {
      console.log('Video can play');
      clearTimeout(loadingTimeout);
      setIsBuffering(false);
      setIsLoading(false);

      // If we were buffering and user wanted to play, resume playback
      // Check if the play button shows we should be playing
      if (isPlaying && video.paused) {
        console.log('Resuming playback after buffering...');
        video.play().catch(err => {
          console.log('Could not auto-resume:', err);
        });
      }
    };

    const handlePlaying = () => {
      console.log('Video is playing');
      setIsBuffering(false);
      setIsLoading(false);
    };

    const handleStalled = () => {
      console.warn('Video stalled - network issue');
      setIsBuffering(true);
    };

    const handleSuspend = () => {
      console.log('Video loading suspended by browser');
      // Browser is being conservative with bandwidth
      // This is normal behavior - it will resume when needed
    };

    const handleProgress = () => {
      // Update buffered amount when data is downloaded
      if (video.buffered.length > 0 && video.duration > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const percentage = (bufferedEnd / video.duration) * 100;
        setBufferedPercentage(percentage);
        console.log(`Buffer: ${percentage.toFixed(1)}%`);
      }
    };

    const handleError = (e: Event) => {
      console.error('Video loading error:', e, 'Source:', src);
      const target = e.target as HTMLVideoElement;
      const error = target.error;
      let message = 'Failed to load video';
      
      if (error) {
        switch (error.code) {
          case error.MEDIA_ERR_ABORTED:
            message = 'Video loading was aborted';
            break;
          case error.MEDIA_ERR_NETWORK:
            message = 'Network error occurred while loading video';
            break;
          case error.MEDIA_ERR_DECODE:
            message = 'Video format is not supported';
            break;
          case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
            message = 'Video source is not supported';
            break;
          default:
            message = 'Unknown video error occurred';
        }
      }
      
      clearTimeout(loadingTimeout);
      setErrorMessage(message);
      setHasError(true);
      setIsLoading(false);
      setIsBuffering(false);
    };

    const handleLoadStart = () => {
      console.log('Video loading started:', src);
      setIsLoading(true);
      setHasError(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('stalled', handleStalled);
    video.addEventListener('suspend', handleSuspend);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('error', handleError);
    video.addEventListener('loadstart', handleLoadStart);

    return () => {
      clearTimeout(loadingTimeout);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('stalled', handleStalled);
      video.removeEventListener('suspend', handleSuspend);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadstart', handleLoadStart);
    };
  }, [src, onTimeUpdate, onEnded]);

  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const togglePlay = async () => {
    if (!videoRef.current) return;

    try {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        // Only try to play if video has some duration (metadata loaded)
        if (videoRef.current.readyState >= 2) {
          await videoRef.current.play();
        } else {
          // Wait for metadata to load first with timeout
          console.log('Waiting for video metadata before playing...');
          setIsLoading(true);

          const waitForCanPlay = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              videoRef.current?.removeEventListener('canplay', onCanPlay);
              reject(new Error('Timeout waiting for video to be ready'));
            }, 8000); // 8 second timeout

            const onCanPlay = () => {
              clearTimeout(timeout);
              videoRef.current?.removeEventListener('canplay', onCanPlay);
              resolve();
            };
            videoRef.current?.addEventListener('canplay', onCanPlay);
          });

          try {
            await waitForCanPlay;
            setIsLoading(false);
            await videoRef.current.play();
          } catch (timeoutError) {
            console.warn('Video took too long to load, attempting play anyway');
            setIsLoading(false);
            // Try to play anyway, might work
            try {
              await videoRef.current.play();
            } catch (playError) {
              console.error('Failed to play video:', playError);
              setHasError(true);
              setErrorMessage('Video failed to load. Please try again.');
            }
          }
        }
      }
    } catch (error) {
      // Ignore AbortError - happens when play is interrupted by another action
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error playing video:', error);
      }
      setIsLoading(false);
    }
  };

  const handleSeek = (value: number[]) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!videoRef.current) return;
    const newVolume = value[0];
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    
    if (isMuted) {
      videoRef.current.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      videoRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const skip = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (isFullscreen) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative bg-black rounded-lg overflow-hidden group',
        isFullscreen && 'fixed inset-0 z-50 rounded-none',
        className
      )}
      onMouseMove={resetControlsTimer}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        preload="auto"
        crossOrigin="anonymous"
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full object-contain"
        onClick={togglePlay}
      />

      {/* Loading Overlay */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}

      {/* Error Overlay */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center p-6 max-w-md">
            <div className="text-red-400 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-white text-lg font-semibold mb-2">Video Error</h3>
            <p className="text-gray-300 text-sm mb-4">{errorMessage}</p>
            <Button
              onClick={() => {
                setHasError(false);
                setIsLoading(true);
                if (videoRef.current) {
                  videoRef.current.load();
                }
              }}
              variant="outline"
              className="text-white border-white hover:bg-white hover:text-black"
            >
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Buffering Overlay */}
      {isBuffering && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black/75 rounded-full p-4">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
        </div>
      )}

      {/* Play Button Overlay */}
      {!isPlaying && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Button
            size="lg"
            onClick={togglePlay}
            className="rounded-full h-16 w-16 bg-white/90 hover:bg-white text-black hover:text-black border-0 shadow-lg"
          >
            <Play className="h-6 w-6 ml-1" />
          </Button>
        </div>
      )}

      {/* Controls */}
      {controls && (
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300',
            showControls ? 'opacity-100' : 'opacity-0'
          )}
        >
          {/* Progress Bar */}
          <div className="mb-4">
            {/* Custom progress bar with buffer indicator */}
            <div className="relative h-2 bg-white/20 rounded-full cursor-pointer group"
                 onClick={(e) => {
                   const rect = e.currentTarget.getBoundingClientRect();
                   const percent = (e.clientX - rect.left) / rect.width;
                   handleSeek([percent * duration]);
                 }}>
              {/* Buffer bar (gray) */}
              <div
                className="absolute h-full bg-white/40 rounded-full transition-all duration-300"
                style={{ width: `${bufferedPercentage}%` }}
              />
              {/* Progress bar (blue) */}
              <div
                className="absolute h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
              {/* Scrubber handle */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `${(currentTime / duration) * 100}%`, marginLeft: '-8px' }}
              />
            </div>
            <div className="flex justify-between text-xs text-white/70 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={togglePlay}
                className="text-white hover:text-white hover:bg-white/20 h-8 w-8 p-0"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => skip(-10)}
                className="text-white hover:text-white hover:bg-white/20 h-8 w-8 p-0"
              >
                <SkipBack className="h-4 w-4" />
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => skip(10)}
                className="text-white hover:text-white hover:bg-white/20 h-8 w-8 p-0"
              >
                <SkipForward className="h-4 w-4" />
              </Button>

              {/* Volume Controls */}
              <div className="flex items-center gap-2 ml-4">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={toggleMute}
                  className="text-white hover:text-white hover:bg-white/20 h-8 w-8 p-0"
                >
                  {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                
                <div className="w-20">
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    max={1}
                    step={0.1}
                    onValueChange={handleVolumeChange}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {title && (
                <span className="text-sm text-white/90 mr-4 max-w-xs truncate">
                  {title}
                </span>
              )}
              
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleFullscreen}
                className="text-white hover:text-white hover:bg-white/20 h-8 w-8 p-0"
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};