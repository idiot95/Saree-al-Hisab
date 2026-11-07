import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Saree al-Hisab',
    short_name: 'Hisab',
    description: 'One set of books for your household. Budget a month, and everything reports against it.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    /* Plum & Rose Gold. The splash is the light ground (ql.css --background); the install's own colour — the
       splash's bar and the task switcher before a page has said otherwise — is the hero plum (--hero), the colour
       the app is known by. Once a page loads, layout.tsx's theme-color follows the scheme. */
    background_color: '#F8F5F4',
    theme_color: '#3A1D36',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
    // share_target is deliberately absent. It is Android-only and needs a
    // parser per bank message format — see the build plan, phase 5.
  };
}
