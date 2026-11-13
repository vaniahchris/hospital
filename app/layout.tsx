import type { Metadata, Viewport } from 'next';
import { DM_Sans } from 'next/font/google';
import { PwaRegister } from '@/components/pwa-register';
import { cn } from '@/lib/utils';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Your Feedback Matters | Value Family Hospital',
  description: 'Help Value Family Hospital provide better care by sharing your experience.',
  applicationName: 'VFH Feedback',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'VFH Feedback',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    shortcut: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#343B6B',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn(dmSans.variable)}>
      <body className="font-sans antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
