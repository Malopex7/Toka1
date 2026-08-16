import type { Metadata } from 'next';
import StreamRoom from '@/components/live/StreamRoom';

interface Props {
  params: Promise<{ roomId: string }>;
}

export const metadata: Metadata = {
  title: 'Live Stream — Toka',
};

export default async function StreamRoomPage({ params }: Props) {
  const { roomId } = await params;
  return <StreamRoom roomId={roomId} />;
}
