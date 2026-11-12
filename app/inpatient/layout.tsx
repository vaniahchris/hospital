import type { Metadata } from 'next';
import './inpatient.css';

export const metadata: Metadata = {
  title: 'Inpatient Feedback | Value Family Hospital',
  description: 'Share your inpatient experience with Value Family Hospital.',
};

export default function InpatientLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="inpatient-root">{children}</div>;
}
