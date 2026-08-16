"use client";
import React, { useEffect, useRef } from 'react';
import { useLocalParticipant } from '@livekit/components-react';

interface MediaRecorderManagerProps {
  isHost: boolean;
  onStop?: () => void;
}

export default function MediaRecorderManager({ isHost, onStop }: MediaRecorderManagerProps) {
  const { localParticipant } = useLocalParticipant();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!isHost || !localParticipant) return;

    let mediaRecorder: MediaRecorder | null = null;

    const startRecording = () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') return;

      const ms = new MediaStream();
      localParticipant.videoTrackPublications.forEach((pub) => {
        if (pub.track?.mediaStreamTrack) ms.addTrack(pub.track.mediaStreamTrack);
      });
      localParticipant.audioTrackPublications.forEach((pub) => {
        if (pub.track?.mediaStreamTrack) ms.addTrack(pub.track.mediaStreamTrack);
      });

      if (ms.getTracks().length === 0) return;

      chunksRef.current = [];
      try {
        const mimeType = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : 'video/webm';

        mediaRecorder = new MediaRecorder(ms, { mimeType });
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        mediaRecorder.onstop = () => {
          if (chunksRef.current.length === 0) return;
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `toka-stream-replay-${Date.now()}.mp4`;
          a.click();
          URL.revokeObjectURL(url);
          onStop?.();
        };
        mediaRecorder.start(1000);
        recorderRef.current = mediaRecorder;
      } catch (err) {
        console.warn('[MediaRecorder] Could not start recording:', err);
      }
    };

    startRecording();
    localParticipant.on('trackPublished', startRecording);

    return () => {
      localParticipant.off('trackPublished', startRecording);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch (_) {}
        recorderRef.current = null;
      }
    };
  }, [isHost, localParticipant, onStop]);

  return null;
}

