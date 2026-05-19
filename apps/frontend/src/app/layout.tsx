import type { Metadata, Viewport } from 'next';
import { Providers } from '@/redux/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Billing System',
  description: 'Real-time POS billing for retail, pharmacy, and hospital counters',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/icon.svg',
  },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Billing' },
};

export const viewport: Viewport = {
  themeColor: '#007bff',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="hold-transition sidebar-mini layout-fixed"
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
