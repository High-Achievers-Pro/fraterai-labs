import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Frater Portal',
  robots: { index: false, follow: false, nocache: true },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
