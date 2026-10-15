import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Triage | Clinical Patient Prioritization System',
  description:
    'Deterministic, explainable clinical triage and intelligent queue prioritization for outpatient departments.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-slate-50 text-slate-900" suppressHydrationWarning>
      <body
        className="min-h-full flex flex-col antialiased selection:bg-blue-600 selection:text-white bg-slate-50 text-slate-900"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
