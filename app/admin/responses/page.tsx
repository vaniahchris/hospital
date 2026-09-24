'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Trash2, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AdminShell } from '../shared';
import { createClient } from '@/lib/supabase/client';
import {
  formatResponseDate,
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
  comment: string | null;
  created_at: string;
  answers: AnswerJoin[];
};

type AdminResponse = {
  submissionId: string;
  createdAt: string;
  id: string;
  date: string;
  comment: string;
  answersByQuestionId: Record<string, string>;
};

const ALL = 'all';

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
    createdAt: row.created_at,
    id: `FB-${1000 + (total - index)}`,
    date: formatResponseDate(row.created_at),
    comment: row.comment ?? '',
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
          'id, comment, created_at, answers(value, question_id, question:questions(id, sort_order, question_type, prompt))'
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
        if (!matchesDateRange(row.createdAt, startDate, endDate)) return false;
        return filterQuestions.every((question) => {
          const selected = questionFilters[question.id] ?? ALL;
          if (selected === ALL) return true;
          return row.answersByQuestionId[question.id] === selected;
        });
      }),
    [responses, startDate, endDate, filterQuestions, questionFilters]
  );

  const filtersActive =
    !!startDate ||
    !!endDate ||
    Object.values(questionFilters).some((value) => value !== ALL);

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
    const questionHeaders = filterQuestions.map((q) => shortPrompt(q.prompt));
    const header = ['ID', 'Date', ...questionHeaders, 'Score', 'Comment'].join(',');
    const rows = filtered.map((r) => {
      const answers = filterQuestions.map((q) => {
        const value = r.answersByQuestionId[q.id] ?? '';
        return `"${value.replaceAll('"', '""')}"`;
      });
      return [
        r.id,
        r.date,
        ...answers,
        String(scoreForResponse(r, filterQuestions) || ''),
        `"${r.comment.replaceAll('"', '""')}"`,
      ].join(',');
    });
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'feedback-responses.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const generatedAt = new Date().toLocaleString();
    const questionHeaders = filterQuestions.map((q) => shortPrompt(q.prompt));

    doc.setFontSize(16);
    doc.text('Value Family Hospital — Patient Responses', 40, 36);
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`Date range: ${formatRangeLabel(startDate, endDate)}`, 40, 54);
    doc.text(`Exported: ${generatedAt} · ${filtered.length} response(s)`, 40, 68);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 84,
      head: [['Response', 'Date', ...questionHeaders, 'Score', 'Comment']],
      body: filtered.map((r) => [
        r.id,
        r.date,
        ...filterQuestions.map((q) => r.answersByQuestionId[q.id] ?? '—'),
        String(scoreForResponse(r, filterQuestions) || '—'),
        r.comment || '—',
      ]),
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [11, 114, 209], textColor: 255 },
      margin: { left: 40, right: 40 },
    });

    doc.save('feedback-responses.pdf');
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
            <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
              <Download data-icon="inline-start" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={exportPdf} disabled={!filtered.length}>
              <FileText data-icon="inline-start" />
              Export PDF
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Filters</CardTitle>
              <CardDescription>
                Date range and active questions. Filters update when questions change.
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
              {filterQuestions.map((question) => (
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

        <Card>
          <CardHeader>
            <CardTitle>Recent responses</CardTitle>
            <CardDescription>
              {loading
                ? 'Loading…'
                : `Showing ${filtered.length} of ${responses.length} response${responses.length === 1 ? '' : 's'}`}
            </CardDescription>
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
                  {filterQuestions.map((question) => (
                    <TableHead key={question.id} title={question.prompt}>
                      {shortPrompt(question.prompt)}
                    </TableHead>
                  ))}
                  <TableHead>Score</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead className="w-12 text-right"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const score = scoreForResponse(row, filterQuestions);
                  return (
                    <TableRow key={row.submissionId}>
                      <TableCell className="font-semibold">{row.id}</TableCell>
                      <TableCell>{row.date}</TableCell>
                      {filterQuestions.map((question) => (
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
                      <TableCell className="max-w-[220px] truncate" title={row.comment}>
                        {row.comment}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          aria-label={`Delete ${row.id}`}
                          disabled={deletingId === row.submissionId}
                          onClick={() => setPendingDelete(row)}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {!loading && !filtered.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {responses.length ? 'No responses match these filters.' : 'No responses yet.'}
              </p>
            ) : null}
          </CardContent>
        </Card>
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
