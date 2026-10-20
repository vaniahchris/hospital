'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Download,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AdminShell } from '../shared';
import { createClient } from '@/lib/supabase/client';
import { parsePatientCsv, type CsvPreview } from '@/lib/patient-csv';
import { normalizeUgandanPhone } from '@/lib/phone';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Patient = {
  id: string;
  name: string;
  phone: string;
  do_not_message: boolean;
  source_filename: string | null;
  updated_at: string;
};

type PatientForm = {
  name: string;
  phone: string;
  do_not_message: boolean;
};

const emptyForm: PatientForm = { name: '', phone: '', do_not_message: false };

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export default function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filename, setFilename] = useState('');
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [form, setForm] = useState<PatientForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Patient | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error: loadError } = await createClient()
      .from('patients')
      .select('*')
      .order('updated_at', { ascending: false });

    if (loadError) setError(loadError.message);
    else setPatients((data as Patient[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter(
      (patient) =>
        patient.name.toLowerCase().includes(query) || patient.phone.toLowerCase().includes(query)
    );
  }, [patients, search]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(patient: Patient) {
    setEditing(patient);
    setForm({
      name: patient.name,
      phone: patient.phone,
      do_not_message: patient.do_not_message,
    });
    setFormError('');
    setFormOpen(true);
  }

  async function savePatient() {
    const name = form.name.trim();
    const phone = normalizeUgandanPhone(form.phone);
    if (!name) {
      setFormError('Name is required.');
      return;
    }
    if (!phone) {
      setFormError('Enter a valid Ugandan mobile number (e.g. 07… or +2567…).');
      return;
    }

    setSaving(true);
    setFormError('');
    setError('');
    setSuccess('');
    const updatedAt = new Date().toISOString();
    const supabase = createClient();

    if (editing) {
      const { error: updateError } = await supabase
        .from('patients')
        .update({
          name,
          phone,
          do_not_message: form.do_not_message,
          updated_at: updatedAt,
        })
        .eq('id', editing.id);

      setSaving(false);
      if (updateError) {
        setFormError(
          updateError.message.includes('patients_phone_unique')
            ? 'Another patient already uses this phone number.'
            : updateError.message
        );
        return;
      }
      setSuccess(`Updated ${name}.`);
    } else {
      const { error: insertError } = await supabase.from('patients').insert({
        name,
        phone,
        do_not_message: form.do_not_message,
        source_filename: 'manual',
        updated_at: updatedAt,
      });

      setSaving(false);
      if (insertError) {
        setFormError(
          insertError.message.includes('patients_phone_unique')
            ? 'A patient with this phone number already exists.'
            : insertError.message
        );
        return;
      }
      setSuccess(`Added ${name}.`);
    }

    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
    await load();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeletingId(target.id);
    setError('');
    setSuccess('');

    const { error: deleteError } = await createClient()
      .from('patients')
      .delete()
      .eq('id', target.id);

    setDeletingId(null);
    setPendingDelete(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setPatients((current) => current.filter((item) => item.id !== target.id));
    setSuccess(`Deleted ${target.name}.`);
  }

  async function selectCsv(file?: File) {
    setError('');
    setSuccess('');
    if (!file) {
      setFilename('');
      setPreview(null);
      return;
    }
    setFilename(file.name);
    setPreview(parsePatientCsv(await file.text()));
  }

  async function importPatients() {
    if (!preview || 'error' in preview || !preview.valid.length) return;
    setImporting(true);
    setError('');
    setSuccess('');
    const updatedAt = new Date().toISOString();
    const rows = preview.valid.map((patient) => ({
      ...patient,
      source_filename: filename,
      updated_at: updatedAt,
    }));
    const { error: importError } = await createClient()
      .from('patients')
      .upsert(rows, { onConflict: 'phone', ignoreDuplicates: false });

    setImporting(false);
    if (importError) {
      setError(importError.message);
      return;
    }
    setSuccess(`Imported ${rows.length} patient${rows.length === 1 ? '' : 's'}.`);
    setFilename('');
    setPreview(null);
    await load();
  }

  async function toggleDoNotMessage(patient: Patient) {
    setBusyId(patient.id);
    setError('');
    const doNotMessage = !patient.do_not_message;
    const { error: updateError } = await createClient()
      .from('patients')
      .update({ do_not_message: doNotMessage, updated_at: new Date().toISOString() })
      .eq('id', patient.id);

    setBusyId(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPatients((current) =>
      current.map((item) =>
        item.id === patient.id ? { ...item, do_not_message: doNotMessage } : item
      )
    );
  }

  function exportCsv() {
    const header = 'name,phone,source,messaging,updated';
    const rows = filteredPatients.map((patient) =>
      [
        csvEscape(patient.name),
        csvEscape(patient.phone),
        csvEscape(patient.source_filename ?? ''),
        patient.do_not_message ? 'do_not_message' : 'messages_allowed',
        csvEscape(new Date(patient.updated_at).toISOString()),
      ].join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'patients.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const generatedAt = new Date().toLocaleString();

    doc.setFontSize(16);
    doc.text('Value Family Hospital — Patients', 40, 36);
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`Exported: ${generatedAt} · ${filteredPatients.length} patient(s)`, 40, 54);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 70,
      head: [['Name', 'Phone', 'Source', 'Messaging', 'Updated']],
      body: filteredPatients.map((patient) => [
        patient.name,
        patient.phone,
        patient.source_filename ?? '—',
        patient.do_not_message ? 'Do not message' : 'Messages allowed',
        new Date(patient.updated_at).toLocaleDateString(),
      ]),
      styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [11, 114, 209], textColor: 255 },
      margin: { left: 40, right: 40 },
    });

    doc.save('patients.pdf');
  }

  return (
    <AdminShell title="Patients">
      <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-2xl font-extrabold tracking-tight">Patients</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Import patient contacts and manage messaging preferences.
            </p>
          </div>
          <Button onClick={openAdd}>
            <Plus data-icon="inline-start" />
            Add patient
          </Button>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {success ? (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Import patients</CardTitle>
            <CardDescription>Upload a CSV with name and phone columns.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              key={filename}
              type="file"
              accept=".csv,text/csv"
              aria-label="Patient CSV file"
              onChange={(event) => selectCsv(event.target.files?.[0])}
            />
            {preview ? (
              'error' in preview ? (
                <Alert variant="destructive">
                  <AlertDescription>{preview.error}</AlertDescription>
                </Alert>
              ) : (
                <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <Badge>{preview.valid.length} valid</Badge>
                    <Badge variant={preview.invalid ? 'destructive' : 'secondary'}>
                      {preview.invalid} invalid
                    </Badge>
                    <Badge variant="outline">
                      {preview.duplicatePhonesInFile} duplicate
                    </Badge>
                  </div>
                  <Button onClick={importPatients} disabled={importing || !preview.valid.length}>
                    <Upload data-icon="inline-start" />
                    {importing ? 'Importing…' : `Import ${preview.valid.length}`}
                  </Button>
                </div>
              )
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Patient directory</CardTitle>
              <CardDescription>
                {loading
                  ? 'Loading…'
                  : `Showing ${filteredPatients.length} of ${patients.length} patients`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportCsv}
                disabled={!filteredPatients.length}
              >
                <Download data-icon="inline-start" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportPdf}
                disabled={!filteredPatients.length}
              >
                <FileText data-icon="inline-start" />
                Export PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="search"
              placeholder="Search by name or phone"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search patients"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Messaging</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell className="font-medium">{patient.name}</TableCell>
                    <TableCell>{patient.phone}</TableCell>
                    <TableCell>{patient.source_filename ?? '—'}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={patient.do_not_message ? 'destructive' : 'outline'}
                        disabled={busyId === patient.id}
                        aria-pressed={patient.do_not_message}
                        onClick={() => toggleDoNotMessage(patient)}
                      >
                        {patient.do_not_message ? 'Do not message' : 'Messages allowed'}
                      </Button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(patient.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Edit ${patient.name}`}
                          onClick={() => openEdit(patient)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Delete ${patient.name}`}
                          onClick={() => setPendingDelete(patient)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!loading && !filteredPatients.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {patients.length ? 'No patients match your search.' : 'No patients yet. Add one or import a CSV.'}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </main>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditing(null);
            setForm(emptyForm);
            setFormError('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit patient' : 'Add patient'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update contact details and messaging preference.'
                : 'Enter a name and Ugandan mobile number.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="patient-name">Name</Label>
              <Input
                id="patient-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Patient name"
                autoComplete="name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="patient-phone">Phone</Label>
              <Input
                id="patient-phone"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="07… or +2567…"
                inputMode="tel"
                autoComplete="tel"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border"
                checked={form.do_not_message}
                onChange={(event) =>
                  setForm((current) => ({ ...current, do_not_message: event.target.checked }))
                }
              />
              Do not message this patient
            </label>
            {formError ? (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={savePatient} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add patient'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this patient?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `This permanently removes ${pendingDelete.name} (${pendingDelete.phone}). This cannot be undone.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!!deletingId}
              onClick={(event) => {
                event.preventDefault();
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
