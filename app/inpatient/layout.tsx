import type { Metadata } from 'next';
import { Nunito } from 'next/font/google';
import './inpatient.css';

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  weight: ['400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: 'Inpatient Feedback | Value Family Hospital',
  description: 'Share your inpatient experience with Value Family Hospital.',
};

export default function InpatientLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={`inpatient-root ${nunito.variable}`}>{children}</div>;
}
