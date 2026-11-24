'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, ListChecks, MessageSquareText, Users, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  scoreForCare,
  shortRecommend,
  shortWait,
  type FormSource,
  type QuestionRow,
} from '@/lib/feedback';
import { INPATIENT_QUESTION_DEFS } from '@/lib/inpatient-questions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type AnswerJoin = {
  value: string;
  question_id: string;
  question: { id: string; sort_order: number; question_type: string; prompt: string } | null;
};

type SubmissionJoin = {
  id: string;
  source: 'outpatient' | 'inpatient';
  inpatient_answers: Record<string, string> | null;
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
  'oklch(0.35 0.09 265)',
  'oklch(0.62 0.08 195)',
  'oklch(0.72 0.12 75)',
  'oklch(0.55 0.04 250)',
  'oklch(0.50 0.14 25)',
  'oklch(0.78 0.03 250)',
];

const metricIcons = {
  responses: MessageSquareText,
  people: Users,
  dashboard: LayoutDashboard,
  questions: ListChecks,
  wallet: Wallet,
} as const;

type BalanceResult = {
  ok?: boolean;
  balance?: string;
  sandbox?: boolean;
  error?: string;
};

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

function inpatientFallbackQuestions(): QuestionRow[] {
  return INPATIENT_QUESTION_DEFS.map((question, index) => ({
    id: question.slug,
    prompt: question.prompt,
    question_type: question.question_type,
    options: question.options,
    sort_order: index + 1,
    is_active: true,
    is_required: true,
    form_source: 'inpatient',
    slug: question.slug,
  }));
}

function statsForQuestions(
  questions: QuestionRow[],
  answersByQuestionId: Record<string, string[]>
): QuestionStats[] {
  return questions.map((question) =>
    buildQuestionStats(question, answersByQuestionId[question.id] ?? [])
  );
}

export default function AdminOverview() {
  const [total, setTotal] = useState(0);
  const [inpatientCount, setInpatientCount] = useState(0);
  const [monthCount, setMonthCount] = useState(0);
  const [monthOutpatientCount, setMonthOutpatientCount] = useState(0);
  const [monthInpatientCount, setMonthInpatientCount] = useState(0);
  const [average, setAverage] = useState(0);
  const [recommendPct, setRecommendPct] = useState(0);
  const [outpatientStats, setOutpatientStats] = useState<QuestionStats[]>([]);
  const [inpatientStats, setInpatientStats] = useState<QuestionStats[]>([]);
  const [breakdownSource, setBreakdownSource] = useState<FormSource>('outpatient');
  const [loading, setLoading] = useState(true);
  const [atBalance, setAtBalance] = useState<string | null>(null);
  const [atBalanceError, setAtBalanceError] = useState('');
  const [atSandbox, setAtSandbox] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const [questionsResult, inpatientQuestionsResult, submissionsResult, balanceResult] =
        await Promise.all([
          supabase
            .from('questions')
            .select('*')
            .eq('form_source', 'outpatient')
            .eq('is_active', true)
            .order('sort_order', { ascending: true }),
          supabase
            .from('questions')
            .select('*')
            .eq('form_source', 'inpatient')
            .eq('is_active', true)
            .order('sort_order', { ascending: true }),
          supabase
            .from('submissions')
            .select(
              'id, source, inpatient_answers, created_at, answers(value, question_id, question:questions(id, sort_order, question_type, prompt))'
            )
            .order('created_at', { ascending: false }),
          supabase.functions.invoke<BalanceResult>('sms-send', {
            body: { action: 'balance' },
          }),
        ]);

      if (balanceResult.error) {
        setAtBalance(null);
        setAtBalanceError(balanceResult.error.message || 'Could not load Africa\'s Talking balance.');
      } else if (balanceResult.data?.error) {
        setAtBalance(null);
        setAtBalanceError(balanceResult.data.error);
      } else {
        setAtBalance(balanceResult.data?.balance ?? null);
        setAtSandbox(!!balanceResult.data?.sandbox);
        setAtBalanceError('');
      }
      setBalanceLoading(false);

      const outpatientQuestions = ((questionsResult.data as QuestionRow[]) ?? []).filter(
        (question) => question.question_type === 'rating' || question.question_type === 'choice'
      );
      const inpatientFromDb = ((inpatientQuestionsResult.data as QuestionRow[]) ?? []).filter(
        (question) => question.question_type === 'rating' || question.question_type === 'choice'
      );
      const inpatientQuestions =
        inpatientFromDb.length > 0 ? inpatientFromDb : inpatientFallbackQuestions();

      const rows = (submissionsResult.data as unknown as SubmissionJoin[]) ?? [];
      const outpatientRows = rows.filter((row) => row.source !== 'inpatient');
      const inpatientRows = rows.filter((row) => row.source === 'inpatient');
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const outpatientAnswers: Record<string, string[]> = {};
      for (const question of outpatientQuestions) outpatientAnswers[question.id] = [];

      let recommendYes = 0;
      let recommendTotal = 0;

      for (const row of outpatientRows) {
        for (const answer of row.answers ?? []) {
          const questionId = answer.question_id || answer.question?.id;
          if (!questionId || !answer.value) continue;
          if (!outpatientAnswers[questionId]) outpatientAnswers[questionId] = [];
          outpatientAnswers[questionId].push(answer.value);

          const type = answer.question?.question_type;
          const prompt = answer.question?.prompt?.toLowerCase() ?? '';
          if (type === 'choice' && prompt.includes('recommend')) {
            recommendTotal += 1;
            if (answer.value.toLowerCase().includes('yes')) recommendYes += 1;
          }
        }
      }

      const inpatientAnswers: Record<string, string[]> = {};
      for (const question of inpatientQuestions) inpatientAnswers[question.id] = [];

      for (const row of inpatientRows) {
        const answers = row.inpatient_answers ?? {};
        for (const question of inpatientQuestions) {
          const slug = question.slug || question.id;
          const value = answers[slug] ?? answers[question.id];
          if (!value) continue;
          inpatientAnswers[question.id].push(value);
        }
      }

      const outpatientBuilt = statsForQuestions(outpatientQuestions, outpatientAnswers);
      const inpatientBuilt = statsForQuestions(inpatientQuestions, inpatientAnswers);

      const firstRating = outpatientBuilt.find((item) => item.question.question_type === 'rating');
      const ratingAverages = outpatientBuilt
        .filter((item) => item.question.question_type === 'rating' && item.average)
        .map((item) => item.average as number);
      const overallAverage = ratingAverages.length
        ? Number(
            (
              ratingAverages.reduce((sum, value) => sum + value, 0) / ratingAverages.length
            ).toFixed(1)
          )
        : firstRating?.average ?? 0;

      const monthOutpatient = outpatientRows.filter(
        (row) => new Date(row.created_at) >= monthStart
      ).length;
      const monthInpatient = inpatientRows.filter(
        (row) => new Date(row.created_at) >= monthStart
      ).length;

      setTotal(outpatientRows.length);
      setInpatientCount(inpatientRows.length);
      setMonthOutpatientCount(monthOutpatient);
      setMonthInpatientCount(monthInpatient);
      setMonthCount(monthOutpatient + monthInpatient);
      setAverage(overallAverage);
      setRecommendPct(recommendTotal ? Math.round((recommendYes / recommendTotal) * 100) : 0);
      setOutpatientStats(outpatientBuilt);
      setInpatientStats(inpatientBuilt);
      setLoading(false);
    }
    load();
  }, []);

  const questionStats = breakdownSource === 'inpatient' ? inpatientStats : outpatientStats;

  const metrics = useMemo(
    () =>
      [
        ['responses', 'Outpatient responses', String(total), 'All time'],
        ['responses', 'Inpatient responses', String(inpatientCount), 'All time'],
        [
          'people',
          'This month',
          String(monthCount),
          `${nowMonthLabel()} · ${monthOutpatientCount} out · ${monthInpatientCount} in`,
        ],
        ['dashboard', 'Avg rating', average ? average.toFixed(1) : '—', 'Across rating questions'],
        ['questions', 'Recommend us', total ? `${recommendPct}%` : '—', 'Yes answers'],
        [
          'wallet',
          'SMS balance',
          balanceLoading ? '…' : atBalance ?? '—',
          atBalanceError
            ? 'Could not load from Africa\'s Talking'
            : atSandbox
              ? 'Africa\'s Talking sandbox'
              : 'Africa\'s Talking account',
        ],
      ] as const,
    [
      total,
      inpatientCount,
      monthCount,
      monthOutpatientCount,
      monthInpatientCount,
      average,
      recommendPct,
      atBalance,
      atBalanceError,
      atSandbox,
      balanceLoading,
    ]
  );

  return (
    <main className="mx-auto max-w-[1400px] space-y-10 p-4 md:px-10 md:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Overview</h2>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading live feedback…' : 'Answer patterns across active questions.'}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/responses">View all responses</Link>
        </Button>
      </div>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        {metrics.map(([icon, label, value, sub]) => {
          const Icon = metricIcons[icon];
          const isBalance = icon === 'wallet';
          const showSkeleton = isBalance ? balanceLoading : loading;
          return (
            <Card key={label} size="sm">
              <CardContent className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="size-3.5 shrink-0" />
                  {label}
                </p>
                {showSkeleton ? (
                  <Skeleton className="h-7 w-14" />
                ) : (
                  <p
                    className="text-2xl font-semibold tabular-nums tracking-tight"
                    title={isBalance && atBalanceError ? atBalanceError : undefined}
                  >
                    {value}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">{sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">Question breakdown</h3>
            <p className="text-sm text-muted-foreground">
              {breakdownSource === 'inpatient'
                ? 'How inpatients answered each question.'
                : 'How outpatients answered each question.'}
            </p>
          </div>
          <Select
            value={breakdownSource}
            onValueChange={(value) => {
              if (value === 'outpatient' || value === 'inpatient') setBreakdownSource(value);
            }}
          >
            <SelectTrigger className="w-full sm:w-48" aria-label="Filter question breakdown by patient type">
              <SelectValue placeholder="Patient type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="outpatient">Outpatients ({total})</SelectItem>
              <SelectItem value="inpatient">Inpatients ({inpatientCount})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {loading
            ? Array.from({ length: 4 }, (_, index) => (
                <Card key={index}>
                  <CardHeader>
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/3" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-48 w-full rounded-md" />
                  </CardContent>
                </Card>
              ))
            : null}

          {!loading &&
            questionStats.map((stats) => (
              <QuestionBreakdownCard
                key={`${breakdownSource}-${stats.question.id}`}
                stats={stats}
              />
            ))}

          {!loading && !questionStats.length ? (
            <div className="lg:col-span-2 rounded-lg border py-12 text-center text-sm text-muted-foreground">
              No active rating or choice questions yet for{' '}
              {breakdownSource === 'inpatient' ? 'inpatients' : 'outpatients'}.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function QuestionBreakdownCard({ stats }: { stats: QuestionStats }) {
  const { question, options, totalAnswers, average } = stats;
  const hasData = totalAnswers > 0;
  const maxCount = Math.max(...options.map((option) => option.count), 1);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base leading-snug" title={question.prompt}>
            {shortPrompt(question.prompt)}
          </CardTitle>
          <CardDescription>
            {question.question_type === 'rating' ? 'Rating question' : 'Multiple choice'} ·{' '}
            {totalAnswers} answer{totalAnswers === 1 ? '' : 's'}
          </CardDescription>
        </div>
        {hasData && average != null ? (
          <Badge variant="secondary" className="shrink-0">
            Avg {average}/5
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No answers yet for this question.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex h-56 items-end gap-2 sm:gap-3">
              {options.map((option, index) => {
                const heightPct = Math.max((option.count / maxCount) * 100, option.count > 0 ? 8 : 0);
                const color = chartColors[index % chartColors.length];
                return (
                  <div key={option.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <span className="text-xs font-medium tabular-nums text-foreground">{option.count}</span>
                    <div className="flex h-44 w-full items-end justify-center rounded-md bg-muted px-1 pt-2">
                      <div
                        className="w-full max-w-12 rounded-t-sm transition-[height]"
                        style={{ height: `${heightPct}%`, background: color }}
                        title={`${option.label}: ${option.count} (${option.pct}%)`}
                      />
                    </div>
                    <span
                      className="line-clamp-2 min-h-8 w-full text-center text-[10px] leading-tight text-muted-foreground"
                      title={option.label}
                    >
                      {option.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-2">
              {options.map((option, index) => (
                <div
                  key={`${option.label}-legend`}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                    <span
                      className="size-2.5 shrink-0 rounded-sm"
                      style={{ background: chartColors[index % chartColors.length] }}
                    />
                    <span className="truncate" title={option.label}>
                      {option.label}
                    </span>
                  </span>
                  <strong className="shrink-0">{option.pct}%</strong>
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
