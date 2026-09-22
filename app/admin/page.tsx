'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, ListChecks, MessageSquareText, Users } from 'lucide-react';
import { AdminShell } from './shared';
import { createClient } from '@/lib/supabase/client';
import { scoreForCare } from '@/lib/feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type AnswerJoin = {
  value: string;
  question: { sort_order: number } | null;
};

type SubmissionJoin = {
  id: string;
  created_at: string;
  answers: AnswerJoin[];
};

const ratingLabels = ['Excellent', 'Very Good', 'Good', 'Fair', 'Poor'] as const;
const chartColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

const metricIcons = {
  responses: MessageSquareText,
  people: Users,
  dashboard: LayoutDashboard,
  questions: ListChecks,
} as const;

export default function AdminOverview() {
  const [total, setTotal] = useState(0);
  const [monthCount, setMonthCount] = useState(0);
  const [average, setAverage] = useState(0);
  const [recommendPct, setRecommendPct] = useState(0);
  const [ratingData, setRatingData] = useState<[string, number, number][]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data } = await supabase
        .from('submissions')
        .select('id, created_at, answers(value, question:questions(sort_order))')
        .order('created_at', { ascending: false });

      const rows = (data as unknown as SubmissionJoin[]) ?? [];
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const careValues: string[] = [];
      let recommendYes = 0;

      for (const row of rows) {
        for (const answer of row.answers ?? []) {
          const order = answer.question?.sort_order;
          if (order === 1) careValues.push(answer.value);
          if (order === 4 && answer.value.toLowerCase().includes('yes')) recommendYes += 1;
        }
      }

      const scores = careValues.map(scoreForCare).filter((n) => n > 0);
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const counts = ratingLabels.map((label) => careValues.filter((v) => v === label).length);
      const careTotal = counts.reduce((a, b) => a + b, 0) || 1;

      setTotal(rows.length);
      setMonthCount(rows.filter((r) => new Date(r.created_at) >= monthStart).length);
      setAverage(Number(avg.toFixed(1)));
      setRecommendPct(rows.length ? Math.round((recommendYes / rows.length) * 100) : 0);
      setRatingData(
        ratingLabels.map((label, i) => [label, counts[i], Math.round((counts[i] / careTotal) * 100)])
      );
      setLoading(false);
    }
    load();
  }, []);

  const metrics = useMemo(
    () =>
      [
        ['responses', 'Total responses', String(total), 'All time'],
        ['people', 'This month', String(monthCount), nowMonthLabel()],
        ['dashboard', 'Average rating', average ? average.toFixed(1) : '—', 'Out of 5'],
        ['questions', 'Recommend us', total ? `${recommendPct}%` : '—', 'Yes answers'],
      ] as const,
    [total, monthCount, average, recommendPct]
  );

  return (
    <AdminShell title="Dashboard">
      <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div>
          <h2 className="font-heading text-2xl font-extrabold tracking-tight">Good afternoon, Admin</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? 'Loading live feedback…' : 'Here is how patients feel about their care experience.'}
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(([icon, label, value, sub]) => {
            const Icon = metricIcons[icon];
            return (
              <Card key={label} size="sm">
                <CardContent className="space-y-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    {loading ? (
                      <Skeleton className="mt-2 h-7 w-16" />
                    ) : (
                      <p className="font-heading text-2xl font-extrabold tracking-tight">{value}</p>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Overall care rating</CardTitle>
                <CardDescription>Distribution of care scores</CardDescription>
              </div>
              <Button variant="link" size="sm" asChild>
                <Link href="/admin/responses">View details</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <div
                  className="relative size-36 shrink-0 rounded-full"
                  style={{
                    background: `conic-gradient(${ratingData
                      .map(([, , pct], i) => {
                        const start = ratingData.slice(0, i).reduce((a, r) => a + r[2], 0);
                        return `${chartColors[i]} ${start}% ${start + pct}%`;
                      })
                      .join(', ') || 'var(--muted) 0 100%'})`,
                  }}
                >
                  <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-card text-center">
                    <strong className="font-heading text-2xl font-extrabold">{average || '—'}</strong>
                    <span className="text-[10px] text-muted-foreground">average rating</span>
                  </div>
                </div>
                <div className="grid w-full flex-1 gap-2">
                  {ratingData.map(([label, , pct], i) => (
                    <div key={label} className="grid grid-cols-[8px_1fr_auto] items-center gap-2 text-xs">
                      <span className="size-2 rounded-full" style={{ background: chartColors[i] }} />
                      <span className="text-muted-foreground">{label}</span>
                      <strong>{pct}%</strong>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rating breakdown</CardTitle>
              <CardDescription>
                Based on {total} response{total === 1 ? '' : 's'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ratingData.map(([label, count, pct]) => (
                <div key={label} className="grid grid-cols-[100px_1fr_40px] items-center gap-3 text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <strong className="text-right">{count}</strong>
                </div>
              ))}
              {!loading && !ratingData.length ? (
                <Badge variant="secondary">No ratings yet</Badge>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </main>
    </AdminShell>
  );
}

function nowMonthLabel() {
  return new Date().toLocaleString('en', { month: 'long' });
}
