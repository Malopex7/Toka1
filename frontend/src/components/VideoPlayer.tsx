"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage, getPerformanceInstance } from '@/lib/firebase';
import { trace } from 'firebase/performance';
import { useFeedStore } from '@/store/useFeedStore';

interface VideoPlayerProps {
  src: string;
  isActive: boolean;
  poster?: string;
}

export default function VideoPlayer({ src, isActive, poster }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoSrc, setVideoSrc] = useState(src);
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

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center cursor-pointer select-none" onClick={togglePlay}>
      <video
        ref={videoRef}
        src={videoSrc}
        poster={poster}
        className="w-full h-full object-cover"
        loop
        playsInline
        muted={isMuted}
        onPlaying={handlePlaying}
      />
      
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 pointer-events-none z-10" />

      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="w-16 h-16 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 transition-transform scale-100 animate-pulse">
            <Play className="w-8 h-8 text-white fill-white ml-1" />
          </div>
        </div>
      )}
    </div>
  );
}
