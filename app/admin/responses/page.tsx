'use client';

import { useEffect, useState } from 'react';
import { AdminIcon, AdminShell } from '../shared';
import { createClient } from '@/lib/supabase/client';
import {
  formatResponseDate,
  scoreForCare,
  shortRecommend,
  shortWait,
  type ResponseRow,
} from '@/lib/feedback';

type AnswerJoin = {
  value: string;
  question: { sort_order: number; question_type: string } | null;
};

type SubmissionJoin = {
  id: string;
  comment: string | null;
  created_at: string;
  answers: AnswerJoin[];
};

function mapSubmission(row: SubmissionJoin, index: number, total: number): ResponseRow {
  const byOrder = new Map<number, string>();
  for (const answer of row.answers ?? []) {
    const order = answer.question?.sort_order;
    if (order) byOrder.set(order, answer.value);
  }

  const care = byOrder.get(1) ?? '—';
  const staff = byOrder.get(2) ?? '—';
  const wait = byOrder.get(3) ?? '—';
  const recommend = byOrder.get(4) ?? '—';

  return {
    id: `FB-${1000 + (total - index)}`,
    date: formatResponseDate(row.created_at),
    care,
    staff,
    wait: shortWait(wait),
    recommend: shortRecommend(recommend),
    score: Number(scoreForCare(care).toFixed(1)) || 0,
    comment: row.comment ?? '',
  };
}

export default function Responses() {
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data, error: loadError } = await supabase
        .from('submissions')
        .select('id, comment, created_at, answers(value, question:questions(sort_order, question_type))')
        .order('created_at', { ascending: false });

      if (loadError) {
        setError(loadError.message);
        setLoading(false);
        return;
      }

      const rows = (data as unknown as SubmissionJoin[]) ?? [];
      setResponses(rows.map((row, index) => mapSubmission(row, index, rows.length)));
      setLoading(false);
    }
    load();
  }, []);

  function exportCsv() {
    const header = 'ID,Date,Care,Staff,Wait,Recommend,Score,Comment';
    const rows = responses.map((r) =>
      [r.id, r.date, r.care, r.staff, r.wait, r.recommend, r.score, `"${r.comment.replaceAll('"', '""')}"`].join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'feedback-responses.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminShell title="Responses">
      <main className="admin-content">
        <div className="admin-heading">
          <div>
            <h2>Patient responses</h2>
            <p>Review feedback and find areas where the care experience can improve.</p>
          </div>
          <div className="admin-toolbar">
            <button className="admin-button secondary" onClick={exportCsv} disabled={!responses.length}>
              <AdminIcon name="export" /> Export CSV
            </button>
          </div>
        </div>
        <section className="admin-panel">
          <div className="panel-header">
            <h3>Recent responses</h3>
            <span>
              {loading ? 'Loading…' : `Showing ${responses.length} response${responses.length === 1 ? '' : 's'}`}
            </span>
          </div>
          {error && <p role="alert">{error}</p>}
          <div className="table-wrap">
            <table className="response-table">
              <thead>
                <tr>
                  <th>Response</th>
                  <th>Date</th>
                  <th>Care</th>
                  <th>Staff</th>
                  <th>Wait time</th>
                  <th>Recommend</th>
                  <th>Score</th>
                  <th>Comment</th>
                </tr>
              </thead>
              <tbody>
                {responses.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.id}</strong></td>
                    <td>{row.date}</td>
                    <td>{row.care}</td>
                    <td>{row.staff}</td>
                    <td>{row.wait}</td>
                    <td>{row.recommend}</td>
                    <td>
                      <span className={`score-pill ${row.score >= 4 ? 'score-high' : 'score-mid'}`}>
                        {row.score}
                      </span>
                    </td>
                    <td className="comment-cell" title={row.comment}>{row.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AdminShell>
  );
}
