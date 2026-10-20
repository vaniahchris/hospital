import type { Metadata } from 'next';
import { AdminAppLayout } from './shared';

export const metadata: Metadata = { title: 'Feedback Admin | Value Family Hospital' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminAppLayout>{children}</AdminAppLayout>;
}
