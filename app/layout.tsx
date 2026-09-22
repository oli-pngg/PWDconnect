import type { Metadata } from 'next';
import { AccessibilityFab } from '@/components/accessibility-fab';
import { AccessibilityOverlays } from '@/components/accessibility-overlays';
import { AccessibilityProvider } from '@/components/accessibility-provider';
import { LanguageProvider } from '@/components/language-provider';
import { SpaceNavigation } from '@/components/space-navigation';
import './globals.css';

export const metadata: Metadata = {
  title: 'PWD Connect | Skills-first work for every ability',
  description: 'An accessible, skills-first job pairing platform for Legazpi City and Albay.',
  applicationName: 'PWD Connect Job Pairing Platform'
};

// Blocking pre-hydration script so saved contrast / text / dyslexia /
// spacing / underline / focus / motion / language apply system-wide before
// first paint — including loading fallbacks, auth, and error states.
function AccessibilityPreloadScript() {
  const script = `(function(){try{var a=localStorage.getItem('pwd-connect-accessibility');var p=a?JSON.parse(a):null;var d=document.documentElement;function b(v,f){return typeof v==='boolean'?v:f}d.dataset.contrast=b(p&&p.contrast,false)?'high':'normal';d.dataset.textSize=b(p&&p.largeText,false)?'large':'normal';d.dataset.reducedMotion=b(p&&p.reducedMotion,false)?'true':'false';d.dataset.visualAlerts=b(p&&p.visualAlerts,true)?'on':'off';d.dataset.captions=b(p&&p.captions,true)?'on':'off';d.dataset.textFirst=b(p&&p.textFirst,true)?'on':'off';d.dataset.spaceNavigation=b(p&&p.spaceNavigation,false)?'on':'off';d.dataset.dyslexia=b(p&&p.dyslexiaFriendly,false)?'on':'off';d.dataset.spacing=b(p&&p.extraSpacing,false)?'wide':'normal';d.dataset.underline=b(p&&p.underlineLinks,false)?'on':'off';d.dataset.focusHighlight=b(p&&p.focusHighlight,false)?'on':'off';d.dataset.classicInvert=b(p&&p.classicInvert,false)?'on':'off';d.dataset.colorFilter=p&&['none','grayscale','red-green','green-red','blue-yellow'].includes(p.colorFilter)?p.colorFilter:'none';d.dataset.liveRecognition=b(p&&p.liveRecognition,false)?'on':'off';d.dataset.showBorders=b(p&&p.showBorders,false)?'on':'off';d.dataset.reduceTransparency=b(p&&p.reduceTransparency,false)?'on':'off';d.dataset.reduceWhitePoint=b(p&&p.reduceWhitePoint,false)?'on':'off';d.dataset.smartInvert=b(p&&p.smartInvert,false)?'on':'off';d.dataset.voiceOver=b(p&&p.voiceOver,false)?'on':'off';d.dataset.zoom=p&&['100','125','150','200'].includes(p.zoom)?p.zoom:'100';d.dataset.dimFlashingLights=b(p&&p.dimFlashingLights,false)?'on':'off';d.dataset.hoverText=b(p&&p.hoverText,false)?'on':'off';d.dataset.hoverTyping=b(p&&p.hoverTyping,false)?'on':'off';var l=localStorage.getItem('pwd-connect-language');d.lang=l==='tl'?'tl':'en';}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <AccessibilityPreloadScript />
      </head>
      <body>
        <a className="skip-link" href="#main-content" lang="en">Skip to main content</a>
        <LanguageProvider>
          <AccessibilityProvider>
            <SpaceNavigation />
            {children}
            <AccessibilityFab />
            <AccessibilityOverlays />
          </AccessibilityProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
