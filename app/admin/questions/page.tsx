'use client';

import { useEffect, useState } from 'react';
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { AdminShell } from '../shared';
import { createClient } from '@/lib/supabase/client';
import {
  defaultOptionsForType,
  fromTypeLabel,
  typeLabel,
  type QuestionRow,
} from '@/lib/feedback';
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
  isNew?: boolean;
};

function toEditable(row: QuestionRow): EditableQuestion {
  return {
    id: row.id,
    text: row.prompt,
    type: typeLabel(row.question_type, row.is_required),
    active: row.is_active,
  };
}

export default function Questions() {
  const [items, setItems] = useState<EditableQuestion[]>([]);
  const [editing, setEditing] = useState<EditableQuestion | null>(null);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);

  const notify = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 1800);
  };

  async function load() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('questions')
      .select('*')
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
    load();
  }, []);

  async function save() {
    if (!editing || !editing.text.trim()) return;
    const supabase = createClient();
    const questionType = fromTypeLabel(editing.type);
    const isRequired = questionType !== 'text';

    if (editing.isNew) {
      const { error } = await supabase.from('questions').insert({
        prompt: editing.text.trim(),
        question_type: questionType,
        options: defaultOptionsForType(questionType),
        sort_order: items.length + 1,
        is_active: true,
        is_required: isRequired,
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
    await load();
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
    <AdminShell title="Questions">
      <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-heading text-2xl font-extrabold tracking-tight">Feedback questions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Change what patients are asked. Changes save to your Supabase database.
            </p>
          </div>
          <Button
            onClick={() =>
              setEditing({
                id: crypto.randomUUID(),
                text: '',
                type: 'Multiple choice',
                active: true,
                isNew: true,
              })
            }
          >
            <Plus data-icon="inline-start" />
            Add question
          </Button>
        </div>

        {editing ? (
          <Card>
            <CardHeader>
              <CardTitle>{editing.isNew ? 'New question' : 'Edit question'}</CardTitle>
              <CardDescription>Live updates apply to the patient form</CardDescription>
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
          {!loading &&
            items.map((question, index) => (
              <Card key={question.id} size="sm">
                <CardContent className="flex items-start gap-3">
                  <GripVertical className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                      Question {index + 1}
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
                      aria-label={`Delete question ${index + 1}`}
                      onClick={() => remove(question.id)}
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
    </AdminShell>
  );
}
