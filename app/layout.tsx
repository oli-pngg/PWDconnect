import type { Metadata } from 'next';
import { LanguageProvider } from '@/components/language-provider';
import { SpaceNavigation } from '@/components/space-navigation';
import './globals.css';

export const metadata: Metadata = {
  title: 'PWD Connect | Skills-first work for every ability',
  description: 'An accessible, skills-first job pairing platform for Legazpi City and Albay.',
  applicationName: 'PWD Connect Job Pairing Platform'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <LanguageProvider>
          <SpaceNavigation />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
