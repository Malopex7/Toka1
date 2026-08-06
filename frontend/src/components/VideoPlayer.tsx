"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  isActive: boolean;
  poster?: string;
}

export default function VideoPlayer({ src, isActive, poster }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

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
  }, [isActive, src]);

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
        src={src}
        poster={poster}
        className="w-full h-full object-cover"
        loop
        playsInline
        muted
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
