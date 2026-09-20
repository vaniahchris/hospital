'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AdminIcon, AdminShell } from './shared';
import { createClient } from '@/lib/supabase/client';
import { scoreForCare } from '@/lib/feedback';

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
    () => [
      ['responses', 'Total responses', String(total), 'All time'],
      ['people', 'This month', String(monthCount), nowMonthLabel()],
      ['dashboard', 'Average rating', average ? average.toFixed(1) : '—', 'Out of 5'],
      ['questions', 'Recommend us', total ? `${recommendPct}%` : '—', 'Yes answers'],
    ] as const,
    [total, monthCount, average, recommendPct]
  );

  return (
    <AdminShell title="Dashboard">
      <main className="admin-content">
        <div className="admin-heading">
          <div>
            <h2>Good afternoon, Admin</h2>
            <p>{loading ? 'Loading live feedback…' : 'Here is how patients feel about their care experience.'}</p>
          </div>
        </div>
        <section className="metric-grid">
          {metrics.map(([icon, label, value, sub]) => (
            <article className="metric-card" key={label}>
              <div className="metric-top">
                <span className="metric-icon"><AdminIcon name={icon} /></span>
              </div>
              <div className="metric-label">{label}</div>
              <div className="metric-value">{value}</div>
              <div className="metric-sub">{sub}</div>
            </article>
          ))}
        </section>
        <section className="dashboard-grid">
          <article className="admin-panel">
            <div className="panel-header">
              <h3>Overall care rating</h3>
              <Link href="/admin/responses">View details</Link>
            </div>
            <div className="donut-wrap">
              <div className="donut">
                <div className="donut-center">
                  <strong>{average || '—'}</strong>
                  average rating
                </div>
              </div>
              <div className="legend">
                {ratingData.map(([label, , pct], i) => (
                  <div className="legend-row" key={label}>
                    <i style={{ background: ['#0a76df', '#52a7ee', '#94c9f3', '#d1e7f9', '#edf4fb'][i] }} />
                    <span>{label}</span>
                    <strong>{pct}%</strong>
                  </div>
                ))}
              </div>
            </div>
          </article>
          <article className="admin-panel rating-panel">
            <div className="panel-header">
              <h3>Rating breakdown</h3>
              <span>Based on {total} responses</span>
            </div>
            <div className="rating-bars">
              {ratingData.map(([label, count, pct]) => (
                <div className="rating-row" key={label}>
                  <span>{label}</span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </AdminShell>
  );
}

function nowMonthLabel() {
  return new Date().toLocaleString('en', { month: 'long' });
}
