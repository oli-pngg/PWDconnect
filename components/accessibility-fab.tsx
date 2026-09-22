'use client';

import { AccessibilityTools } from '@/components/accessibility-tools';

/**
 * System-wide floating accessibility entry point — bottom-left corner.
 * Present on EVERY page (landing, auth, dashboard, jobs, assessment,
 * messages, employer, admin, loading + error states). Shares global
 * AccessibilityProvider state with header toolbars. Alt+A toggles it.
 */
export function AccessibilityFab() {
  return (
    <div className="accessibility-fab">
      <AccessibilityTools enableGlobalShortcut />
    </div>
  );
}
