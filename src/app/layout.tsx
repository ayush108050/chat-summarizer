import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Outer Wilds Triage — Rumor Mode',
  description: 'AI-powered chat log triage visualised as an Outer Wilds Ship Log graph.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
