import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Your Feedback Matters | Ndejje Health Centre',
  description: 'Help Ndejje Health Centre provide better care by sharing your experience.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
