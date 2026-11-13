'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  markUrgentIdsSeen,
  needsFollowUp,
  readSeenUrgentIds,
  SEEN_URGENT_KEY,
  type FollowUpSubmission,
} from '@/lib/follow-up';
import { formatResponseDate } from '@/lib/feedback';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const POLL_MS = 60_000;
const PREVIEW_LIMIT = 8;

type PreviewItem = {
  id: string;
  source: 'outpatient' | 'inpatient';
  createdAt: string;
  contact: string;
  unseen: boolean;
};

export function FollowUpNotifications({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [followUpIds, setFollowUpIds] = useState<string[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const followUpIdsRef = useRef<string[]>([]);

  const applyRows = useCallback((rows: FollowUpSubmission[]) => {
    const followUps = rows.filter(needsFollowUp);
    const seen = new Set(readSeenUrgentIds());
    const ids = followUps.map((row) => row.id);
    followUpIdsRef.current = ids;
    setFollowUpIds(ids);

    const unseen = followUps.filter((row) => !seen.has(row.id));
    setUnseenCount(unseen.length);

    const previewSource = unseen.length ? unseen : followUps;
    setItems(
      previewSource.slice(0, PREVIEW_LIMIT).map((row) => ({
        id: row.id,
        source: row.source,
        createdAt: row.created_at,
        contact: row.contact_phone?.trim() || row.contact_email?.trim() || '—',
        unseen: !seen.has(row.id),
      }))
    );
  }, []);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('submissions')
      .select(
        'id, source, inpatient_answers, contact_email, contact_phone, created_at, answers(value, question_id)'
      )
      .order('created_at', { ascending: false });

    if (error) {
      setLoading(false);
      return;
    }

    applyRows((data as FollowUpSubmission[] | null) ?? []);
    setLoading(false);
  }, [applyRows]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    const onFocus = () => refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === SEEN_URGENT_KEY) refresh();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    window.addEventListener('follow-up-seen', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('follow-up-seen', onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    // Only lock scroll on small screens where the sheet covers content.
    const mq = window.matchMedia('(max-width: 767px)');
    if (mq.matches) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function markAllAsRead() {
    const ids = followUpIdsRef.current.length ? followUpIdsRef.current : followUpIds;
    if (!ids.length) {
      setUnseenCount(0);
      return;
    }
    markUrgentIdsSeen(ids);
    setUnseenCount(0);
    setItems((current) => current.map((item) => ({ ...item, unseen: false })));
  }

  function markOneSeen(id: string) {
    markUrgentIdsSeen([id]);
    setUnseenCount((count) => Math.max(0, count - 1));
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, unseen: false } : item))
    );
  }

  const badgeLabel = useMemo(() => {
    if (unseenCount <= 0) return null;
    return unseenCount > 9 ? '9+' : String(unseenCount);
  }, [unseenCount]);

  const panel = (
    <div
      role="dialog"
      aria-label="Follow-up notifications"
      className={cn(
        'flex max-h-[min(32rem,calc(100svh-5rem))] flex-col overflow-hidden rounded-lg border bg-background shadow-lg',
        // Mobile: fixed sheet under the top bar, inset from screen edges
        'fixed top-14 right-3 left-3 z-50',
        // Desktop: dropdown anchored to the bell
        'md:absolute md:top-full md:right-0 md:left-auto md:mt-2 md:w-[22rem]'
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Needs follow-up</p>
          <p className="text-xs text-muted-foreground">
            Negative responses with contact details
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 md:hidden"
          aria-label="Close notifications"
          onClick={() => setOpen(false)}
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : items.length ? (
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/admin/responses?tab=urgent&source=${item.source}`}
                  onClick={() => {
                    markOneSeen(item.id);
                    setOpen(false);
                  }}
                  className="block px-3 py-2.5 text-sm transition-colors hover:bg-muted/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 font-medium capitalize">
                      {item.unseen ? (
                        <span
                          className="size-1.5 shrink-0 rounded-full bg-destructive"
                          aria-hidden
                        />
                      ) : null}
                      {item.source}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatResponseDate(item.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.contact}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No follow-ups waiting.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2 border-t p-2">
        {items.length ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full"
            disabled={unseenCount <= 0}
            onClick={markAllAsRead}
          >
            <CheckCheck className="size-3.5" data-icon="inline-start" />
            {unseenCount > 0 ? 'Mark all as read' : 'All caught up'}
          </Button>
        ) : null}
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href="/admin/responses?tab=urgent" onClick={() => setOpen(false)}>
            Open follow-ups
          </Link>
        </Button>
      </div>
    </div>
  );

  return (
    <div ref={panelRef} className={cn('relative overflow-visible', className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={
          badgeLabel
            ? `${unseenCount} follow-up${unseenCount === 1 ? '' : 's'} need attention`
            : 'Follow-up notifications'
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className="relative overflow-visible"
      >
        <Bell className="size-4" />
        {badgeLabel ? (
          <span className="pointer-events-none absolute top-0 right-0 z-10 flex h-4 min-w-4 translate-x-1/3 -translate-y-1/3 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white shadow-sm ring-2 ring-background">
            {badgeLabel}
          </span>
        ) : null}
      </Button>

      {open ? (
        <>
          {/* Mobile scrim so the sheet reads as a modal and taps outside close it */}
          <button
            type="button"
            className="fixed inset-0 z-40 bg-foreground/20 md:hidden"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          {panel}
        </>
      ) : null}
    </div>
  );
}
