import type { Metadata } from 'next';
import LiveDiscoveryPage from '@/components/live/LiveDiscoveryPage';

export const metadata: Metadata = {
  title: 'Live Streams — Toka',
  description: 'Watch live streams from creators on the Toka platform.',
};

export default function LivePage() {
  return <LiveDiscoveryPage />;
}
