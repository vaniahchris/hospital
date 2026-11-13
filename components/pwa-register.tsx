'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Installability still works from the manifest when SW registration fails.
    });
  }, []);

  return null;
}

/** Compact install hint for admin chrome — shown only when installable / on iOS. */
export function PwaInstallHint({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [standalone, setStandalone] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('pwa-install-dismissed');
    if (stored === '1') setDismissed(true);

    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
    setStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
        // iOS Safari
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Boolean((navigator as any).standalone)
    );

    function onPrompt(event: Event) {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (dismissed || standalone) return null;
  if (!deferred && !isIOS) return null;

  return (
    <div className={className}>
      <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Install Feedback Admin</p>
        {deferred ? (
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              className="h-7"
              onClick={async () => {
                await deferred.prompt();
                setDeferred(null);
              }}
            >
              Install
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => {
                window.localStorage.setItem('pwa-install-dismissed', '1');
                setDismissed(true);
              }}
            >
              Not now
            </Button>
          </div>
        ) : (
          <p className="mt-1">
            On iPhone: Share → Add to Home Screen.
          </p>
        )}
      </div>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}
