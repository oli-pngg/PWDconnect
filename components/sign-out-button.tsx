'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return <button className="button secondary small" type="button" onClick={signOut}><LogOut size={15} aria-hidden="true" /> Sign out</button>;
}
