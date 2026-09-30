'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, ListChecks, MessageSquareText, Users } from 'lucide-react';
import { AdminShell } from './shared';
import { createClient } from '@/lib/supabase/client';
import {
  scoreForCare,
  shortRecommend,
  shortWait,
  type QuestionRow,
} from '@/lib/feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type AnswerJoin = {
  value: string;
  question_id: string;
  question: { id: string; sort_order: number; question_type: string; prompt: string } | null;
};

type SubmissionJoin = {
  id: string;
  created_at: string;
  answers: AnswerJoin[];
};

type OptionStat = {
  label: string;
  count: number;
  pct: number;
};

type QuestionStats = {
  question: QuestionRow;
  totalAnswers: number;
  average: number | null;
  options: OptionStat[];
};

const chartColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  '#94a3b8',
  '#64748b',
];

const metricIcons = {
  responses: MessageSquareText,
  people: Users,
  dashboard: LayoutDashboard,
  questions: ListChecks,
} as const;

function displayAnswer(value: string) {
  const recommend = shortRecommend(value);
  if (recommend !== value) return recommend;
  const wait = shortWait(value);
  if (wait !== value) return wait;
  return value;
}

function shortPrompt(prompt: string) {
  const cleaned = prompt.trim();
  if (cleaned.length <= 56) return cleaned;
  return `${cleaned.slice(0, 53)}…`;
}

function buildQuestionStats(question: QuestionRow, values: string[]): QuestionStats {
  const normalized = values.map(displayAnswer);
  const labels =
    question.options?.length > 0
      ? question.options.map((option) => displayAnswer(option.label))
      : [...new Set(normalized)].sort((a, b) => a.localeCompare(b));

  const counts = labels.map((label) => normalized.filter((value) => value === label).length);
  const answerTotal = counts.reduce((sum, count) => sum + count, 0) || 1;
  const options = labels.map((label, index) => ({
    label,
    count: counts[index],
    pct: Math.round((counts[index] / answerTotal) * 100),
  }));

  let average: number | null = null;
  if (question.question_type === 'rating') {
    const scores = normalized.map(scoreForCare).filter((n) => n > 0);
    average = scores.length
      ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1))
      : null;
  }

  return {
    question,
    totalAnswers: normalized.length,
    average,
    options,
  };
}

export default function AdminOverview() {
  const [total, setTotal] = useState(0);
  const [monthCount, setMonthCount] = useState(0);
  const [average, setAverage] = useState(0);
  const [recommendPct, setRecommendPct] = useState(0);
  const [questionStats, setQuestionStats] = useState<QuestionStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const [questionsResult, submissionsResult] = await Promise.all([
        supabase
          .from('questions')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('submissions')
          .select(
            'id, created_at, answers(value, question_id, question:questions(id, sort_order, question_type, prompt))'
          )
          .order('created_at', { ascending: false }),
      ]);

      const questions = ((questionsResult.data as QuestionRow[]) ?? []).filter(
        (question) => question.question_type === 'rating' || question.question_type === 'choice'
      );
      const rows = (submissionsResult.data as unknown as SubmissionJoin[]) ?? [];
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const answersByQuestionId: Record<string, string[]> = {};
      for (const question of questions) answersByQuestionId[question.id] = [];

      let recommendYes = 0;
      let recommendTotal = 0;

      for (const row of rows) {
        for (const answer of row.answers ?? []) {
          const questionId = answer.question_id || answer.question?.id;
          if (!questionId || !answer.value) continue;
          if (!answersByQuestionId[questionId]) answersByQuestionId[questionId] = [];
          answersByQuestionId[questionId].push(answer.value);

          const type = answer.question?.question_type;
          const prompt = answer.question?.prompt?.toLowerCase() ?? '';
          if (type === 'choice' && prompt.includes('recommend')) {
            recommendTotal += 1;
            if (answer.value.toLowerCase().includes('yes')) recommendYes += 1;
          }
        }
      }

      const stats = questions.map((question) =>
        buildQuestionStats(question, answersByQuestionId[question.id] ?? [])
      );

      const firstRating = stats.find((item) => item.question.question_type === 'rating');
      const ratingAverages = stats
        .filter((item) => item.question.question_type === 'rating' && item.average)
        .map((item) => item.average as number);
      const overallAverage = ratingAverages.length
        ? Number(
            (
              ratingAverages.reduce((sum, value) => sum + value, 0) / ratingAverages.length
            ).toFixed(1)
          )
        : firstRating?.average ?? 0;

      setTotal(rows.length);
      setMonthCount(rows.filter((r) => new Date(r.created_at) >= monthStart).length);
      setAverage(overallAverage);
      setRecommendPct(recommendTotal ? Math.round((recommendYes / recommendTotal) * 100) : 0);
      setQuestionStats(stats);
      setLoading(false);
    }
    load();
  }, []);

  const metrics = useMemo(
    () =>
      [
        ['responses', 'Total responses', String(total), 'All time'],
        ['people', 'This month', String(monthCount), nowMonthLabel()],
        ['dashboard', 'Avg rating', average ? average.toFixed(1) : '—', 'Across rating questions'],
        ['questions', 'Recommend us', total ? `${recommendPct}%` : '—', 'Yes answers'],
      ] as const,
    [total, monthCount, average, recommendPct]
  );

  return (
    <AdminShell title="Dashboard">
      <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-heading text-2xl font-extrabold tracking-tight">Good afternoon, Admin</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? 'Loading live feedback…'
                : 'Breakdown of answers for each active question.'}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/responses">View all responses</Link>
          </Button>
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

        <section className="grid gap-4 lg:grid-cols-2">
          {loading
            ? Array.from({ length: 4 }, (_, index) => (
                <Card key={index}>
                  <CardHeader>
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/3" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-36 w-full rounded-xl" />
                  </CardContent>
                </Card>
              ))
            : null}

          {!loading &&
            questionStats.map((stats) => (
              <QuestionBreakdownCard key={stats.question.id} stats={stats} />
            ))}

          {!loading && !questionStats.length ? (
            <Card className="lg:col-span-2">
              <CardContent className="py-10 text-center">
                <Badge variant="secondary">No active rating or choice questions yet</Badge>
              </CardContent>
            </Card>
          ) : null}
        </section>
      </main>
    </AdminShell>
  );
}

function QuestionBreakdownCard({ stats }: { stats: QuestionStats }) {
  const { question, options, totalAnswers, average } = stats;
  const hasData = totalAnswers > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base leading-snug" title={question.prompt}>
          {shortPrompt(question.prompt)}
        </CardTitle>
        <CardDescription>
          {question.question_type === 'rating' ? 'Rating question' : 'Multiple choice'} ·{' '}
          {totalAnswers} answer{totalAnswers === 1 ? '' : 's'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No answers yet for this question.</p>
        ) : (
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div
              className="relative mx-auto size-36 shrink-0 rounded-full sm:mx-0"
              style={{
                background: `conic-gradient(${options
                  .map((option, index) => {
                    const start = options.slice(0, index).reduce((sum, item) => sum + item.pct, 0);
                    return `${chartColors[index % chartColors.length]} ${start}% ${start + option.pct}%`;
                  })
                  .join(', ')})`,
              }}
            >
              <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-card text-center">
                {average != null ? (
                  <>
                    <strong className="font-heading text-2xl font-extrabold">{average}</strong>
                    <span className="text-[10px] text-muted-foreground">avg / 5</span>
                  </>
                ) : (
                  <>
                    <strong className="font-heading text-2xl font-extrabold">{totalAnswers}</strong>
                    <span className="text-[10px] text-muted-foreground">answers</span>
                  </>
                )}
              </div>
            </div>

            <div className="grid w-full flex-1 gap-3">
              {options.map((option, index) => (
                <div key={option.label} className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: chartColors[index % chartColors.length] }}
                      />
                      <span className="truncate" title={option.label}>
                        {option.label}
                      </span>
                    </span>
                    <strong className="shrink-0">
                      {option.count} · {option.pct}%
                    </strong>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${option.pct}%`,
                        background: chartColors[index % chartColors.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function nowMonthLabel() {
  return new Date().toLocaleString('en', { month: 'long' });
}
