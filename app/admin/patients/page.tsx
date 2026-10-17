'use client';

import { useEffect, useMemo, useState } from 'react';
import { Upload } from 'lucide-react';
import { AdminShell } from '../shared';
import { createClient } from '@/lib/supabase/client';
import { parsePatientCsv, type CsvPreview } from '@/lib/patient-csv';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

export default function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [filename, setFilename] = useState('');
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  return (
    <AdminShell title="Patients">
      <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div>
          <h2 className="font-heading text-2xl font-extrabold tracking-tight">Patients</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Import patient contacts and manage messaging preferences.
          </p>
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
          <CardHeader>
            <CardTitle>Patient directory</CardTitle>
            <CardDescription>
              {loading
                ? 'Loading…'
                : `Showing ${filteredPatients.length} of ${patients.length} patients`}
            </CardDescription>
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
                  <TableHead className="text-right">Updated</TableHead>
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
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(patient.updated_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!loading && !filteredPatients.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {patients.length ? 'No patients match your search.' : 'No patients imported yet.'}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </AdminShell>
  );
}
