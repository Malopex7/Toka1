"use client";
import React, { useEffect, useRef } from 'react';

interface MediaRecorderManagerProps {
  stream: MediaStream | null;
  isRecording: boolean;
  onStop?: () => void;
}

export default function MediaRecorderManager({ stream, isRecording, onStop }: MediaRecorderManagerProps) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!stream) return;

    if (isRecording) {
      chunksRef.current = [];
      try {
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `toka-stream-replay-${Date.now()}.mp4`;
          a.click();
          URL.revokeObjectURL(url);
          onStop?.();
        };
        recorder.start(1000); // collect in 1-second chunks
        recorderRef.current = recorder;
      } catch (err) {
        console.warn('[MediaRecorder] Could not start recording:', err);
      }
    } else {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
        recorderRef.current = null;
      }
    }
  }, [isRecording, stream, onStop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    };
  }, []);

  return null; // headless component
}
