"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage, getPerformanceInstance } from '@/lib/firebase';
import { trace } from 'firebase/performance';
import { useFeedStore } from '@/store/useFeedStore';

interface VideoPlayerProps {
  src: string;
  isActive: boolean;
  poster?: string;
}

function formatTime(seconds: number) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function VideoPlayer({ src, isActive, poster }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoSrc, setVideoSrc] = useState(src);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const isMuted = useFeedStore((state) => state.isMuted);

  const mediaTraceRef = useRef<any>(null);

  // Tracing media stream start latency
  useEffect(() => {
    if (isActive && videoSrc) {
      const perf = getPerformanceInstance();
      if (perf) {
        try {
          if (mediaTraceRef.current) {
            mediaTraceRef.current.stop();
          }
          const t = trace(perf, 'media-stream-latency');
          t.start();
          console.log(`[Perf] Started media-stream-latency trace for: ${videoSrc.substring(0, 40)}...`);
          mediaTraceRef.current = t;
        } catch (e) {
          console.error('[Perf] Failed to start media-stream-latency trace:', e);
        }
      }
    }

    return () => {
      if (mediaTraceRef.current) {
        try {
          mediaTraceRef.current.stop();
          mediaTraceRef.current = null;
        } catch (e) {}
      }
    };
  }, [isActive, videoSrc]);

  const handlePlaying = () => {
    if (mediaTraceRef.current) {
      try {
        mediaTraceRef.current.stop();
        console.log('[Perf] Stopped media-stream-latency trace (video is playing)');
        mediaTraceRef.current = null;
      } catch (e) {}
    }
  };

  // Resolve Firebase Storage paths/URLs dynamically to CDN-cached HTTP download URLs
  useEffect(() => {
    const resolveSrc = async () => {
      if (!src) {
        setVideoSrc('');
        return;
      }

      // Check if this matches a Firebase Storage path
      if (src.startsWith('gs://') || (!src.startsWith('http://') && !src.startsWith('https://') && src.trim() !== '')) {
        try {
          let path = src;
          if (src.startsWith('gs://')) {
            const match = src.match(/gs:\/\/[^\/]+\/(.+)/);
            path = match ? match[1] : src;
          }
          const storageRef = ref(storage, path);
          const downloadUrl = await getDownloadURL(storageRef);
          setVideoSrc(downloadUrl);
        } catch (err) {
          console.error("Error resolving Firebase Storage video URL:", err);
          setVideoSrc(src); // Fallback to raw src path
        }
      } else {
        setVideoSrc(src);
      }
    };

    resolveSrc();
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              video.play()
                .then(() => setIsPlaying(true))
                .catch((err) => console.log("Autoplay blocked:", err.message));
            } else {
              video.pause();
              setIsPlaying(false);
            }
          });
        },
        { threshold: 0.6 }
      );

      observer.observe(video);
      return () => {
        observer.unobserve(video);
        video.pause();
      };
    } else {
      video.pause();
      if (video.currentTime > 0) {
        video.currentTime = 0;
      }
      setTimeout(() => {
        setIsPlaying(false);
      }, 0);
    }
  }, [isActive, videoSrc]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.log("Play failed:", err.message));
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || isScrubbing) return;
    setCurrentTime(video.currentTime);
    if (video.duration && !isNaN(video.duration)) {
      setDuration(video.duration);
    }
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.duration && !isNaN(video.duration)) {
      setDuration(video.duration);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = videoRef.current;
    const bar = progressBarRef.current;
    if (!video || !bar || !duration) return;

    const rect = bar.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const newTime = (clickX / rect.width) * duration;

    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center select-none overflow-hidden">
      <video
        ref={videoRef}
        src={videoSrc}
        poster={poster}
        className="w-full h-full object-cover"
        loop
        playsInline
        muted={isMuted}
        onPlaying={handlePlaying}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />
      
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 pointer-events-none z-10" />

      {/* Large Central Pause Indicator (when paused) */}
      {!isPlaying && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="absolute inset-0 flex items-center justify-center z-20 cursor-pointer pointer-events-auto"
        >
          <div className="w-16 h-16 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 transition-transform hover:scale-110 active:scale-95 shadow-2xl">
            <Play className="w-8 h-8 text-white fill-white ml-1" />
          </div>
        </div>
      )}

      {/* Bottom Progress Bar & Micro Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-40 px-4 pb-2 pt-4 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col gap-1.5 pointer-events-auto select-none group/player">
        
        {/* Top Control Line: Micro Play/Pause & Live Timestamp */}
        <div className="flex items-center justify-between px-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="w-7 h-7 rounded-full bg-black/60 hover:bg-toka-flare backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition-all shadow-md active:scale-90 cursor-pointer"
            title={isPlaying ? "Pause Video" : "Play Video"}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 text-white fill-white" />
            ) : (
              <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
            )}
          </button>

          {duration > 0 && (
            <span className="text-[10px] font-mono font-bold text-cloud-white/80 drop-shadow-md">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          )}
        </div>

        {/* Seekable Progress Bar Scrubber */}
        <div
          ref={progressBarRef}
          onClick={handleSeek}
          onMouseDown={() => setIsScrubbing(true)}
          onMouseUp={() => setIsScrubbing(false)}
          onTouchStart={() => setIsScrubbing(true)}
          onTouchMove={handleSeek}
          onTouchEnd={() => setIsScrubbing(false)}
          className="relative w-full h-1.5 hover:h-2.5 rounded-full bg-white/20 hover:bg-white/30 transition-all cursor-pointer flex items-center overflow-hidden"
          title="Scrub video"
        >
          <div
            className="h-full bg-toka-flare transition-[width] duration-100 ease-linear rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
