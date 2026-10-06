'use client';

import { useEffect, useMemo, useState } from 'react';
import { BedDouble, Download, FileText, PhoneCall, Trash2, Users, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AdminShell } from '../shared';
import { createClient } from '@/lib/supabase/client';
import {
  formatResponseDate,
  hasNegativeReview,
  scoreForCare,
  shortRecommend,
  shortWait,
  type QuestionRow,
} from '@/lib/feedback';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type AnswerJoin = {
  value: string;
  question_id: string;
  question: {
    id: string;
    sort_order: number;
    question_type: string;
    prompt: string;
  } | null;
};

type SubmissionJoin = {
  id: string;
  source: 'outpatient' | 'inpatient';
  inpatient_answers: Record<string, string> | null;
  comment: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  answers: AnswerJoin[];
};

type AdminResponse = {
  submissionId: string;
  source: 'outpatient' | 'inpatient';
  inpatientAnswers: Record<string, string>;
  createdAt: string;
  id: string;
  date: string;
  comment: string;
  contactEmail: string;
  contactPhone: string;
  answersByQuestionId: Record<string, string>;
};

const ALL = 'all';
const inpatientQuestions = [
  { id: 'care', prompt: 'Quality of care' },
  { id: 'staff', prompt: 'Staff' },
  { id: 'room', prompt: 'Room' },
  { id: 'recommend', prompt: 'Recommend' },
];
const SEEN_URGENT_KEY = 'admin-seen-urgent-ids';

function readSeenUrgentIds() {
  if (typeof window === 'undefined') return [] as string[];
  try {
    const raw = window.localStorage.getItem(SEEN_URGENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeSeenUrgentIds(ids: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SEEN_URGENT_KEY, JSON.stringify(ids));
}

function displayAnswer(value: string) {
  const recommend = shortRecommend(value);
  if (recommend !== value) return recommend;
  const wait = shortWait(value);
  if (wait !== value) return wait;
  return value;
}

function shortPrompt(prompt: string) {
  const cleaned = prompt.trim();
  if (cleaned.length <= 32) return cleaned;
  return `${cleaned.slice(0, 29)}…`;
}

function mapSubmission(row: SubmissionJoin, index: number, total: number): AdminResponse {
  const answersByQuestionId: Record<string, string> = {};
  for (const answer of row.answers ?? []) {
    const questionId = answer.question_id || answer.question?.id;
    if (!questionId || !answer.value) continue;
    answersByQuestionId[questionId] = displayAnswer(answer.value);
  }

  return {
    submissionId: row.id,
    source: row.source ?? 'outpatient',
    inpatientAnswers: row.inpatient_answers ?? {},
    createdAt: row.created_at,
    id: `FB-${1000 + (total - index)}`,
    date: formatResponseDate(row.created_at),
    comment: row.comment ?? '',
    contactEmail: row.contact_email ?? '',
    contactPhone: row.contact_phone ?? '',
    answersByQuestionId,
  };
}

function localDateKey(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function matchesDateRange(createdAt: string, startDate: string, endDate: string) {
  const key = localDateKey(createdAt);
  if (startDate && key < startDate) return false;
  if (endDate && key > endDate) return false;
  return true;
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter((v) => v && v !== '—'))].sort((a, b) => a.localeCompare(b));
}

function formatRangeLabel(startDate: string, endDate: string) {
  if (startDate && endDate) return `${startDate} to ${endDate}`;
  if (startDate) return `From ${startDate}`;
  if (endDate) return `Through ${endDate}`;
  return 'All dates';
}

function scoreForResponse(row: AdminResponse, questions: QuestionRow[]) {
  if (row.source === 'inpatient') return scoreForCare(row.inpatientAnswers.care);
  const rating = questions.find((q) => q.question_type === 'rating');
  if (!rating) return 0;
  return scoreForCare(row.answersByQuestionId[rating.id]);
}

export default function Responses() {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [responses, setResponses] = useState<AdminResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminResponse | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [questionFilters, setQuestionFilters] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('all');
  const [source, setSource] = useState<'outpatient' | 'inpatient'>('outpatient');
  const [seenUrgentIds, setSeenUrgentIds] = useState<string[]>([]);

  useEffect(() => {
    setSeenUrgentIds(readSeenUrgentIds());
  }, []);

  const filterQuestions = useMemo(
    () => questions.filter((q) => q.question_type === 'rating' || q.question_type === 'choice'),
    [questions]
  );

  async function load() {
    setLoading(true);
    setError('');
    const supabase = createClient();

    const [questionsResult, submissionsResult] = await Promise.all([
      supabase.from('questions').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase
        .from('submissions')
        .select(
          'id, source, inpatient_answers, comment, contact_email, contact_phone, created_at, answers(value, question_id, question:questions(id, sort_order, question_type, prompt))'
        )
        .order('created_at', { ascending: false }),
    ]);

    if (questionsResult.error) {
      setError(questionsResult.error.message);
      setLoading(false);
      return;
    }
    if (submissionsResult.error) {
      setError(submissionsResult.error.message);
      setLoading(false);
      return;
    }

    const nextQuestions = (questionsResult.data as QuestionRow[]) ?? [];
    const rows = (submissionsResult.data as unknown as SubmissionJoin[]) ?? [];

    setQuestions(nextQuestions);
    setResponses(rows.map((row, index) => mapSubmission(row, index, rows.length)));
    setQuestionFilters((prev) => {
      const next: Record<string, string> = {};
      for (const question of nextQuestions) {
        if (question.question_type === 'rating' || question.question_type === 'choice') {
          next[question.id] = prev[question.id] ?? ALL;
        }
      }
      return next;
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      responses.filter((row) => {
        if (row.source !== source) return false;
        if (!matchesDateRange(row.createdAt, startDate, endDate)) return false;
        return source === 'inpatient' || filterQuestions.every((question) => {
          const selected = questionFilters[question.id] ?? ALL;
          if (selected === ALL) return true;
          return row.answersByQuestionId[question.id] === selected;
        });
      }),
    [responses, source, startDate, endDate, filterQuestions, questionFilters]
  );

  const urgentFiltered = useMemo(
    () =>
      filtered.filter(
        (row) =>
          (!!row.contactPhone || !!row.contactEmail) &&
          (row.source === 'inpatient'
            ? hasNegativeReview(row.inpatientAnswers) || ['Unlikely', 'Very Unlikely'].includes(row.inpatientAnswers.recommend)
            : hasNegativeReview(row.answersByQuestionId))
      ),
    [filtered]
  );

  const unseenUrgentCount = useMemo(
    () => urgentFiltered.filter((row) => !seenUrgentIds.includes(row.submissionId)).length,
    [urgentFiltered, seenUrgentIds]
  );

  const visibleRows = activeTab === 'urgent' ? urgentFiltered : filtered;

  useEffect(() => {
    if (activeTab !== 'urgent' || !urgentFiltered.length) return;
    const currentIds = urgentFiltered.map((row) => row.submissionId);
    setSeenUrgentIds((prev) => {
      const next = [...new Set([...prev, ...currentIds])];
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) return prev;
      writeSeenUrgentIds(next);
      return next;
    });
  }, [activeTab, urgentFiltered]);

  const filtersActive =
    !!startDate ||
    !!endDate ||
    (source === 'outpatient' && Object.values(questionFilters).some((value) => value !== ALL));

  const outpatientCount = responses.filter((row) => row.source === 'outpatient').length;
  const inpatientCount = responses.filter((row) => row.source === 'inpatient').length;
  const sourceCount = source === 'inpatient' ? inpatientCount : outpatientCount;
  const urgentCount = urgentFiltered.length;
  const columnHeaders = source === 'inpatient'
    ? inpatientQuestions.map((question) => question.prompt)
    : filterQuestions.map((question) => shortPrompt(question.prompt));
  const answerCells = (row: AdminResponse) => source === 'inpatient'
    ? inpatientQuestions.map((question) => row.inpatientAnswers[question.id] ?? '')
    : filterQuestions.map((question) => row.answersByQuestionId[question.id] ?? '');

  function clearFilters() {
    setStartDate('');
    setEndDate('');
    setQuestionFilters((prev) => {
      const next: Record<string, string> = {};
      for (const id of Object.keys(prev)) next[id] = ALL;
      return next;
    });
  }

  function optionsForQuestion(question: QuestionRow) {
    const fromConfig = (question.options ?? []).map((option) => displayAnswer(option.label));
    const fromAnswers = responses.map((row) => row.answersByQuestionId[question.id] ?? '');
    return uniqueSorted([...fromConfig, ...fromAnswers]);
  }

  function exportCsv() {
    const header = ['ID', 'Date', ...columnHeaders, 'Score', 'Comment', 'Phone', 'Email'].join(',');
    const rows = visibleRows.map((r) => {
      const answers = answerCells(r).map((value) => `"${value.replaceAll('"', '""')}"`);
      return [
        r.id,
        r.date,
        ...answers,
        String(scoreForResponse(r, filterQuestions) || ''),
        `"${r.comment.replaceAll('"', '""')}"`,
        `"${r.contactPhone.replaceAll('"', '""')}"`,
        `"${r.contactEmail.replaceAll('"', '""')}"`,
      ].join(',');
    });
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedback-${source}-${activeTab === 'urgent' ? 'follow-up' : 'responses'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const generatedAt = new Date().toLocaleString();
    const questionHeaders = columnHeaders;
    const title =
      activeTab === 'urgent'
        ? `Value Family Hospital — ${source} follow-up`
        : `Value Family Hospital — ${source} responses`;

    doc.setFontSize(16);
    doc.text(title, 40, 36);
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`Date range: ${formatRangeLabel(startDate, endDate)}`, 40, 54);
    doc.text(`Exported: ${generatedAt} · ${visibleRows.length} response(s)`, 40, 68);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 84,
      head: [['Response', 'Date', ...questionHeaders, 'Score', 'Comment', 'Phone', 'Email']],
      body: visibleRows.map((r) => [
        r.id,
        r.date,
        ...answerCells(r).map((answer) => answer || '—'),
        String(scoreForResponse(r, filterQuestions) || '—'),
        r.comment || '—',
        r.contactPhone || '—',
        r.contactEmail || '—',
      ]),
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [11, 114, 209], textColor: 255 },
      margin: { left: 40, right: 40 },
    });

    doc.save(`feedback-${source}-${activeTab === 'urgent' ? 'follow-up' : 'responses'}.pdf`);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeletingId(target.submissionId);
    setError('');

    const supabase = createClient();
    const { error: answersError } = await supabase
      .from('answers')
      .delete()
      .eq('submission_id', target.submissionId);

    if (answersError) {
      setError(answersError.message);
      setDeletingId(null);
      setPendingDelete(null);
      return;
    }

    const { error: deleteError } = await supabase
      .from('submissions')
      .delete()
      .eq('id', target.submissionId);

    setDeletingId(null);
    setPendingDelete(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setResponses((prev) => prev.filter((row) => row.submissionId !== target.submissionId));
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
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={!visibleRows.length}>
              <Download data-icon="inline-start" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={exportPdf} disabled={!visibleRows.length}>
              <FileText data-icon="inline-start" />
              Export PDF
            </Button>
          </div>
        </div>

        <Tabs
          value={source}
          onValueChange={(value) => {
            setSource(value as 'outpatient' | 'inpatient');
            setActiveTab('all');
          }}
          className="gap-3"
        >
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Patient type
            </p>
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border bg-card p-1.5 shadow-sm sm:max-w-xl">
              <TabsTrigger
                value="outpatient"
                className="group h-12 gap-2 rounded-lg px-3 text-sm font-semibold text-foreground/70 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Users className="size-4" />
                Outpatients
                <Badge
                  variant="secondary"
                  className="ml-0.5 h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px] group-data-[state=active]:border-transparent group-data-[state=active]:bg-primary-foreground/20 group-data-[state=active]:text-primary-foreground"
                >
                  {outpatientCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="inpatient"
                className="group h-12 gap-2 rounded-lg px-3 text-sm font-semibold text-foreground/70 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <BedDouble className="size-4" />
                Inpatients
                <Badge
                  variant="secondary"
                  className="ml-0.5 h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px] group-data-[state=active]:border-transparent group-data-[state=active]:bg-primary-foreground/20 group-data-[state=active]:text-primary-foreground"
                >
                  {inpatientCount}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Filters</CardTitle>
              <CardDescription>
                {source === 'inpatient'
                  ? 'Filter inpatient responses by date.'
                  : 'Date range and active questions. Filters update when questions change.'}
              </CardDescription>
            </div>
            {filtersActive ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X data-icon="inline-start" />
                Clear filters
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <div className="grid gap-1.5">
                <Label htmlFor="filter-start">Start date</Label>
                <Input
                  id="filter-start"
                  type="date"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="filter-end">End date</Label>
                <Input
                  id="filter-end"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              {source === 'outpatient' &&
                filterQuestions.map((question) => (
                  <FilterSelect
                    key={question.id}
                    id={`filter-${question.id}`}
                    label={shortPrompt(question.prompt)}
                    value={questionFilters[question.id] ?? ALL}
                    onChange={(value) =>
                      setQuestionFilters((prev) => ({ ...prev, [question.id]: value }))
                    }
                    options={optionsForQuestion(question)}
                  />
                ))}
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value ?? 'all')} className="gap-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Response view
            </p>
            <TabsList className="grid h-auto w-full grid-cols-1 gap-1 rounded-xl border bg-card p-1.5 shadow-sm sm:max-w-xl sm:grid-cols-2">
              <TabsTrigger
                value="all"
                className="group h-12 gap-2 rounded-lg px-3 text-sm font-semibold text-foreground/70 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                All responses
                <Badge
                  variant="secondary"
                  className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px] group-data-[state=active]:border-transparent group-data-[state=active]:bg-primary-foreground/20 group-data-[state=active]:text-primary-foreground"
                >
                  {filtered.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="urgent"
                className="h-12 gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-900 hover:bg-amber-100 data-[state=active]:border-amber-600 data-[state=active]:bg-amber-600 data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:hover:bg-amber-600"
              >
                <PhoneCall className="size-4" />
                Needs follow-up
                <Badge
                  className={`h-5 min-w-5 justify-center rounded-full border-transparent px-1.5 text-[11px] ${
                    activeTab === 'urgent'
                      ? 'bg-white/20 text-white'
                      : unseenUrgentCount > 0
                        ? 'bg-destructive text-white'
                        : 'bg-amber-200 text-amber-950'
                  }`}
                >
                  {unseenUrgentCount > 0 ? unseenUrgentCount : urgentCount}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="mt-4">
            <ResponseTableCard
              title="Recent responses"
              description={
                loading
                  ? 'Loading…'
                  : `Showing ${visibleRows.length} of ${sourceCount} response${sourceCount === 1 ? '' : 's'}`
              }
              error={error}
              loading={loading}
              rows={visibleRows}
              totalCount={sourceCount}
              emptyFilteredMessage="No responses match these filters."
              filterQuestions={filterQuestions}
              source={source}
              deletingId={deletingId}
              onDelete={setPendingDelete}
            />
          </TabsContent>

          <TabsContent value="urgent" className="mt-4">
            <ResponseTableCard
              title="Urgent follow-up"
              description={
                loading
                  ? 'Loading…'
                  : `${urgentFiltered.length} negative response${urgentFiltered.length === 1 ? '' : 's'} with contact details — reach out as soon as possible.`
              }
              error={error}
              loading={loading}
              rows={visibleRows}
              totalCount={
                responses.filter(
                  (r) =>
                    r.source === source && (!!r.contactPhone || !!r.contactEmail) &&
                    (source === 'inpatient'
                      ? hasNegativeReview(r.inpatientAnswers) || ['Unlikely', 'Very Unlikely'].includes(r.inpatientAnswers.recommend)
                      : hasNegativeReview(r.answersByQuestionId))
                ).length
              }
              emptyFilteredMessage="No urgent follow-ups match these filters."
              emptyAllMessage="No negative reviews with contact details yet."
              filterQuestions={filterQuestions}
              source={source}
              deletingId={deletingId}
              onDelete={setPendingDelete}
              urgent
            />
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this response?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `This permanently removes ${pendingDelete.id} and its answers. This cannot be undone.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!!deletingId}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {deletingId ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}

function ResponseTableCard({
  title,
  description,
  error,
  loading,
  rows,
  totalCount,
  emptyFilteredMessage,
  emptyAllMessage = 'No responses yet.',
  filterQuestions,
  source,
  deletingId,
  onDelete,
  urgent = false,
}: {
  title: string;
  description: string;
  error: string;
  loading: boolean;
  rows: AdminResponse[];
  totalCount: number;
  emptyFilteredMessage: string;
  emptyAllMessage?: string;
  filterQuestions: QuestionRow[];
  source: 'outpatient' | 'inpatient';
  deletingId: string | null;
  onDelete: (row: AdminResponse) => void;
  urgent?: boolean;
}) {
  return (
    <Card className={urgent ? 'ring-1 ring-destructive/20' : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {urgent ? <PhoneCall className="size-4 text-destructive" /> : null}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
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
              {source === 'inpatient'
                ? inpatientQuestions.map((question) => <TableHead key={question.id}>{question.prompt}</TableHead>)
                : filterQuestions.map((question) => (
                    <TableHead key={question.id} title={question.prompt}>
                      {shortPrompt(question.prompt)}
                    </TableHead>
                  ))}
              <TableHead>Score</TableHead>
              <TableHead>Comment</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-12 text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const score = scoreForResponse(row, filterQuestions);
              return (
                <TableRow key={row.submissionId} className={urgent ? 'bg-destructive/5' : undefined}>
                  <TableCell className="font-semibold">{row.id}</TableCell>
                  <TableCell>{row.date}</TableCell>
                  {source === 'inpatient'
                    ? inpatientQuestions.map((question) => (
                        <TableCell key={question.id}>{row.inpatientAnswers[question.id] || '—'}</TableCell>
                      ))
                    : filterQuestions.map((question) => (
                        <TableCell key={question.id}>
                          {row.answersByQuestionId[question.id] ?? '—'}
                        </TableCell>
                      ))}
                  <TableCell>
                    {score ? (
                      <Badge
                        variant="secondary"
                        className={
                          score >= 4
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-800'
                        }
                      >
                        {score}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate" title={row.comment}>
                    {row.comment || '—'}
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate font-medium" title={row.contactPhone}>
                    {row.contactPhone || '—'}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate font-medium" title={row.contactEmail}>
                    {row.contactEmail || '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      aria-label={`Delete ${row.id}`}
                      disabled={deletingId === row.submissionId}
                      onClick={() => onDelete(row)}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {!loading && !rows.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {totalCount ? emptyFilteredMessage : emptyAllMessage}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} title={label}>
        {label}
      </Label>
      <Select value={value} onValueChange={(next) => onChange(next ?? ALL)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
