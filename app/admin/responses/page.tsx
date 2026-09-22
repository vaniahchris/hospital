'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { AdminShell } from '../shared';
import { createClient } from '@/lib/supabase/client';
import {
  formatResponseDate,
  scoreForCare,
  shortRecommend,
  shortWait,
  type ResponseRow,
} from '@/lib/feedback';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
      <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-heading text-2xl font-extrabold tracking-tight">Patient responses</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review feedback and find areas where the care experience can improve.
            </p>
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={!responses.length}>
            <Download data-icon="inline-start" />
            Export CSV
          </Button>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recent responses</CardTitle>
              <CardDescription>
                {loading
                  ? 'Loading…'
                  : `Showing ${responses.length} response${responses.length === 1 ? '' : 's'}`}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Response</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Care</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Wait time</TableHead>
                  <TableHead>Recommend</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Comment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {responses.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-semibold">{row.id}</TableCell>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{row.care}</TableCell>
                    <TableCell>{row.staff}</TableCell>
                    <TableCell>{row.wait}</TableCell>
                    <TableCell>{row.recommend}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          row.score >= 4
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-800'
                        }
                      >
                        {row.score}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate" title={row.comment}>
                      {row.comment}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!loading && !responses.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No responses yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </AdminShell>
  );
}
