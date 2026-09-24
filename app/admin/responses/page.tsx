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
  type ResponseRow,
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
  question: { sort_order: number; question_type: string } | null;
};

type SubmissionJoin = {
  id: string;
  comment: string | null;
  created_at: string;
  answers: AnswerJoin[];
};

type AdminResponse = ResponseRow & {
  submissionId: string;
  createdAt: string;
};

const ALL = 'all';

function mapSubmission(row: SubmissionJoin, index: number, total: number): AdminResponse {
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
    submissionId: row.id,
    createdAt: row.created_at,
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

export default function Responses() {
  const [responses, setResponses] = useState<AdminResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminResponse | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [care, setCare] = useState(ALL);
  const [staff, setStaff] = useState(ALL);
  const [wait, setWait] = useState(ALL);
  const [recommend, setRecommend] = useState(ALL);

  async function load() {
    setLoading(true);
    setError('');
    const supabase = createClient();
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

  useEffect(() => {
    load();
  }, []);

  const careOptions = useMemo(() => uniqueSorted(responses.map((r) => r.care)), [responses]);
  const staffOptions = useMemo(() => uniqueSorted(responses.map((r) => r.staff)), [responses]);
  const waitOptions = useMemo(() => uniqueSorted(responses.map((r) => r.wait)), [responses]);
  const recommendOptions = useMemo(
    () => uniqueSorted(responses.map((r) => r.recommend)),
    [responses]
  );

  const filtered = useMemo(
    () =>
      responses.filter(
        (row) =>
          matchesDateRange(row.createdAt, startDate, endDate) &&
          (care === ALL || row.care === care) &&
          (staff === ALL || row.staff === staff) &&
          (wait === ALL || row.wait === wait) &&
          (recommend === ALL || row.recommend === recommend)
      ),
    [responses, startDate, endDate, care, staff, wait, recommend]
  );

  const filtersActive =
    !!startDate || !!endDate || care !== ALL || staff !== ALL || wait !== ALL || recommend !== ALL;

  function clearFilters() {
    setStartDate('');
    setEndDate('');
    setCare(ALL);
    setStaff(ALL);
    setWait(ALL);
    setRecommend(ALL);
  }

  function exportCsv() {
    const header = 'ID,Date,Care,Staff,Wait,Recommend,Score,Comment';
    const rows = filtered.map((r) =>
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

  function exportPdf() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const generatedAt = new Date().toLocaleString();

    doc.setFontSize(16);
    doc.text('Value Family Hospital — Patient Responses', 40, 36);
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`Date range: ${formatRangeLabel(startDate, endDate)}`, 40, 54);
    doc.text(`Exported: ${generatedAt} · ${filtered.length} response(s)`, 40, 68);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 84,
      head: [['Response', 'Date', 'Care', 'Staff', 'Wait', 'Recommend', 'Score', 'Comment']],
      body: filtered.map((r) => [
        r.id,
        r.date,
        r.care,
        r.staff,
        r.wait,
        r.recommend,
        String(r.score),
        r.comment || '—',
      ]),
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [11, 114, 209], textColor: 255 },
      columnStyles: {
        7: { cellWidth: 160 },
      },
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
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Recent responses</CardTitle>
                <CardDescription>
                  {loading
                    ? 'Loading…'
                    : `Showing ${filtered.length} of ${responses.length} response${responses.length === 1 ? '' : 's'}`}
                </CardDescription>
              </div>
              {filtersActive ? (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X data-icon="inline-start" />
                  Clear filters
                </Button>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
              <FilterSelect
                id="filter-care"
                label="Care"
                value={care}
                onChange={setCare}
                options={careOptions}
              />
              <FilterSelect
                id="filter-staff"
                label="Staff"
                value={staff}
                onChange={setStaff}
                options={staffOptions}
              />
              <FilterSelect
                id="filter-wait"
                label="Wait time"
                value={wait}
                onChange={setWait}
                options={waitOptions}
              />
              <FilterSelect
                id="filter-recommend"
                label="Recommend"
                value={recommend}
                onChange={setRecommend}
                options={recommendOptions}
              />
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
                  <TableHead className="w-12 text-right"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.submissionId}>
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
                ))}
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
      <Label htmlFor={id}>{label}</Label>
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
