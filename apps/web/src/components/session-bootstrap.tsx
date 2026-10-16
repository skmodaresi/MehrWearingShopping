'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { refreshSessionAction } from '@/actions/auth';

/**
 * The layout renders this once when the access cookie has expired but a
 * refresh cookie is still valid: rotate tokens server-side, then re-render so
 * signed-in UI (account menu, orders) reappears without a manual reload.
 */
export function SessionBootstrap({ needsRefresh }: { needsRefresh: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!needsRefresh) return;
    let cancelled = false;
    void (async () => {
      const { refreshed } = await refreshSessionAction();
      if (refreshed && !cancelled) router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [needsRefresh, router]);

  return null;
}
