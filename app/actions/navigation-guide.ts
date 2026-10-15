'use server';

import { redirect } from 'next/navigation';

export async function continueFromNavigationGuide() {
  redirect('/landing');
}
