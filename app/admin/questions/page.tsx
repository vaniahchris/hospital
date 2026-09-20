'use client';

import { useEffect, useState } from 'react';
import { AdminIcon, AdminShell } from '../shared';
import { createClient } from '@/lib/supabase/client';
import {
  defaultOptionsForType,
  fromTypeLabel,
  typeLabel,
  type QuestionRow,
} from '@/lib/feedback';

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
      <main className="admin-content">
        <div className="admin-heading">
          <div>
            <h2>Feedback questions</h2>
            <p>Change what patients are asked. Changes save to your Supabase database.</p>
          </div>
          <div className="admin-toolbar">
            <button
              className="admin-button"
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
              <AdminIcon name="plus" /> Add question
            </button>
          </div>
        </div>

        {editing && (
          <section className="admin-panel edit-panel">
            <div className="panel-header">
              <h3>{editing.isNew ? 'New question' : 'Edit question'}</h3>
              <span>Live</span>
            </div>
            <div className="edit-grid">
              <div className="field">
                <label htmlFor="question-text">Question text</label>
                <input
                  id="question-text"
                  value={editing.text}
                  onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="field">
                <label htmlFor="question-type">Answer type</label>
                <select
                  id="question-type"
                  value={editing.type}
                  onChange={(e) => setEditing({ ...editing, type: e.target.value })}
                >
                  <option>Rating scale</option>
                  <option>Multiple choice</option>
                  <option>Long text · Optional</option>
                </select>
              </div>
            </div>
            <div className="edit-actions">
              <button className="admin-button secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="admin-button" onClick={save} disabled={!editing.text.trim()}>
                Save question
              </button>
            </div>
          </section>
        )}

        <section className="question-list">
          {loading && <p>Loading questions…</p>}
          {!loading &&
            items.map((question, index) => (
              <article className="question-item" key={question.id}>
                <div className="drag-handle" title="Drag to reorder">⠿</div>
                <div className="question-copy">
                  <div className="question-number">Question {index + 1}</div>
                  <h3>{question.text}</h3>
                  <div className="question-meta">
                    <span className="type-pill">{question.type}</span>
                    <span><i className="status-dot" /> {question.active ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
                <div className="question-actions">
                  <button
                    className="icon-button"
                    aria-label={`Edit question ${index + 1}`}
                    onClick={() => setEditing(question)}
                  >
                    <AdminIcon name="edit" />
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label={`Delete question ${index + 1}`}
                    onClick={() => remove(question.id)}
                  >
                    <AdminIcon name="trash" />
                  </button>
                </div>
              </article>
            ))}
        </section>
        {toast && <div className="toast" role="status">{toast}</div>}
      </main>
    </AdminShell>
  );
}
