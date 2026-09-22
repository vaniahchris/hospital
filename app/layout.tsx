import type { Metadata } from 'next';
import { DM_Sans, Manrope } from 'next/font/google';
import { cn } from '@/lib/utils';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Your Feedback Matters | Value Family Hospital',
  description: 'Help Value Family Hospital provide better care by sharing your experience.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn(dmSans.variable, manrope.variable)}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
