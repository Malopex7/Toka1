import { Suspense } from 'react';
import VideoFeed from "@/components/VideoFeed";

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-screen items-center justify-center bg-midnight-boma text-cloud-white font-sans">
        <span className="w-10 h-10 border-4 border-toka-flare border-t-transparent rounded-full animate-spin"></span>
      </div>
    }>
      <VideoFeed />
    </Suspense>
  );
}
