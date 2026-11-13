'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  markUrgentIdsSeen,
  needsFollowUp,
  readSeenUrgentIds,
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
      if (event.key === 'admin-follow-up-seen-ids') refresh();
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

  function markAllCurrentSeen() {
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

  function toggleOpen() {
    if (!open) {
      // Opening the inbox acknowledges current follow-ups → badge clears.
      markAllCurrentSeen();
      setOpen(true);
      return;
    }
    setOpen(false);
  }

  const badgeLabel = useMemo(() => {
    if (unseenCount <= 0) return null;
    return unseenCount > 9 ? '9+' : String(unseenCount);
  }, [unseenCount]);

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
        onClick={toggleOpen}
        className="relative overflow-visible"
      >
        <Bell className="size-4" />
        {badgeLabel ? (
          <span className="pointer-events-none absolute -top-1 -right-1 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white shadow-sm">
            {badgeLabel}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-label="Follow-up notifications"
          className="absolute top-full right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-lg border bg-background shadow-lg"
        >
          <div className="border-b px-3 py-2.5">
            <p className="text-sm font-semibold">Needs follow-up</p>
            <p className="text-xs text-muted-foreground">
              Negative responses with contact details
            </p>
          </div>
          <div className="max-h-72 overflow-y-auto">
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
                        <span className="font-medium capitalize">{item.source}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatResponseDate(item.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.contact}
                      </p>
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
          <div className="border-t p-2">
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link
                href="/admin/responses?tab=urgent"
                onClick={() => {
                  markAllCurrentSeen();
                  setOpen(false);
                }}
              >
                Open follow-ups
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
