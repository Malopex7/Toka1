import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Toka - Short Video Community',
    short_name: 'Toka',
    description: 'Discover, share, and support creators with micro-tips and brand sponsorships on Toka.',
    start_url: '/',
    id: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0a0c',
    theme_color: '#FF4F00',
    orientation: 'portrait',
    lang: 'en',
    categories: ['entertainment', 'social', 'video'],
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
