'use client';

import { useEffect, useState } from 'react';
import { BedDouble, GripVertical, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  defaultOptionsForType,
  fromTypeLabel,
  type FormSource,
  typeLabel,
  type QuestionRow,
} from '@/lib/feedback';
import { cn } from '@/lib/utils';
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

type EditableQuestion = {
  id: string;
  text: string;
  type: string;
  active: boolean;
  formSource: FormSource;
  slug: string | null;
  isNew?: boolean;
};

function toEditable(row: QuestionRow): EditableQuestion {
  return {
    id: row.id,
    text: row.prompt,
    type: typeLabel(row.question_type, row.is_required),
    active: row.is_active,
    formSource: row.form_source ?? 'outpatient',
    slug: row.slug ?? null,
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

export default function Questions() {
  const [source, setSource] = useState<FormSource>('outpatient');
  const [items, setItems] = useState<EditableQuestion[]>([]);
  const [editing, setEditing] = useState<EditableQuestion | null>(null);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);

  const notify = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 1800);
  };

  async function load(nextSource: FormSource = source) {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('form_source', nextSource)
      .order('sort_order', { ascending: true });
    if (error) {
      notify(error.message);
      setLoading(false);
      return;
    }
    setItems((data as QuestionRow[]).map(toEditable));
    setLoading(false);
  }

  useEffect(() => {
    load(source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  async function save() {
    if (!editing || !editing.text.trim()) return;
    const supabase = createClient();
    const questionType = fromTypeLabel(editing.type);
    const isRequired = questionType !== 'text';
    const formSource = editing.formSource;

    if (editing.isNew) {
      const slug =
        formSource === 'inpatient'
          ? editing.slug?.trim() || slugify(editing.text) || `q_${Date.now()}`
          : null;
      const { error } = await supabase.from('questions').insert({
        prompt: editing.text.trim(),
        question_type: questionType,
        options: defaultOptionsForType(questionType),
        sort_order: items.length + 1,
        is_active: true,
        is_required: isRequired,
        form_source: formSource,
        slug,
      });
      if (error) {
        notify(error.message);
        return;
      }
      notify('Question added');
    } else {
      const { error } = await supabase
        .from('questions')
        .update({
          prompt: editing.text.trim(),
          question_type: questionType,
          is_required: isRequired,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editing.id);
      if (error) {
        notify(error.message);
        return;
      }
      notify('Question saved');
    }

    setEditing(null);
    await load(formSource);
  }

  async function remove(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from('questions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      notify(error.message);
      return;
    }
    notify('Question deactivated');
    await load();
  }

  return (
    <main className="mx-auto max-w-[1400px] space-y-10 p-4 md:px-10 md:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Feedback questions</h2>
          <p className="text-sm text-muted-foreground">
            Manage what outpatients and inpatients are asked.
          </p>
        </div>
        <Button
          onClick={() =>
            setEditing({
              id: crypto.randomUUID(),
              text: '',
              type: 'Multiple choice',
              active: true,
              formSource: source,
              slug: null,
              isNew: true,
            })
          }
        >
          <Plus data-icon="inline-start" />
          Add question
        </Button>
      </div>

      <div
        role="tablist"
        aria-label="Patient type"
        className="grid h-10 w-full max-w-md grid-cols-2 rounded-lg border border-border bg-muted p-1"
      >
        {(
          [
            { value: 'outpatient' as const, label: 'Outpatients', icon: Users },
            { value: 'inpatient' as const, label: 'Inpatients', icon: BedDouble },
          ] as const
        ).map((option) => {
          const Icon = option.icon;
          const active = source === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setEditing(null);
                setSource(option.value);
              }}
              className={cn(
                'inline-flex h-full items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="size-4" />
              {option.label}
            </button>
          );
        })}
      </div>

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>{editing.isNew ? 'New question' : 'Edit question'}</CardTitle>
            <CardDescription>
              {editing.formSource === 'inpatient' ? 'Inpatient form' : 'Outpatient form'} · live
              updates apply to the patient form
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <div className="grid gap-2">
                <Label htmlFor="question-text">Question text</Label>
                <Input
                  id="question-text"
                  value={editing.text}
                  onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="question-type">Answer type</Label>
                <Select
                  value={editing.type}
                  onValueChange={(value) => setEditing({ ...editing, type: value ?? editing.type })}
                >
                  <SelectTrigger id="question-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Rating scale">Rating scale</SelectItem>
                    <SelectItem value="Multiple choice">Multiple choice</SelectItem>
                    <SelectItem value="Long text · Optional">Long text · Optional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={!editing.text.trim()}>
                Save question
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-3">
        {loading ? <p className="text-sm text-muted-foreground">Loading questions…</p> : null}
        {!loading && !items.length ? (
          <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
            No {source === 'inpatient' ? 'inpatient' : 'outpatient'} questions yet.
          </p>
        ) : null}
        {!loading &&
          items.map((question, index) => (
            <Card key={question.id} size="sm">
              <CardContent className="flex items-start gap-3">
                <GripVertical className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                    Question {index + 1}
                    {question.slug ? ` · ${question.slug}` : ''}
                  </p>
                  <h3 className="mt-1 text-sm font-semibold">{question.text}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{question.type}</Badge>
                    <Badge variant={question.active ? 'default' : 'outline'}>
                      {question.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit question ${index + 1}`}
                    onClick={() => setEditing(question)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    aria-label={`Deactivate question ${index + 1}`}
                    onClick={() => remove(question.id)}
                    disabled={!question.active}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
      </section>

      {toast ? (
        <div
          className="fixed right-6 bottom-6 z-20 rounded-lg bg-foreground px-4 py-3 text-xs text-background shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </main>
  );
}
