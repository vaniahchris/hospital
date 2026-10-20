'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  countSmsParts,
  FEEDBACK_INVITE_BOTH,
  FEEDBACK_INVITE_INPATIENT,
  FEEDBACK_INVITE_OUTPATIENT,
  isWithinSmsPartLimit,
  pickFeedbackInviteBody,
} from '@/lib/sms';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type MessageKind = 'broadcast' | 'single' | 'feedback_invite';

type Patient = {
  id: string;
  name: string;
  phone: string;
};

type SmsMessage = {
  id: string;
  kind: MessageKind;
  body: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  status: 'pending' | 'sent' | 'partial' | 'failed';
  created_at: string;
};

type SmsRecipient = {
  id: string;
  phone: string;
  status: 'queued' | 'sent' | 'failed';
  error: string | null;
  cost: string | null;
};

type SendResult = {
  error?: string;
  recipientCount?: number;
  sentCount?: number;
  failedCount?: number;
  status?: string;
};

async function invokeErrorMessage(error: unknown, fallback: string) {
  const invokeError = error as { message?: string; context?: Response };
  let message = invokeError.message || fallback;
  try {
    if (invokeError.context) {
      const payload = (await invokeError.context.json()) as { error?: string };
      if (payload.error) message = payload.error;
    }
  } catch {
    // Keep the function client's message when the response is not JSON.
  }
  return message;
}

function kindLabel(kind: MessageKind) {
  if (kind === 'feedback_invite') return 'Feedback invite';
  return kind[0].toUpperCase() + kind.slice(1);
}

export default function Messages() {
  const [kind, setKind] = useState<MessageKind>('broadcast');
  const [body, setBody] = useState('');
  const [patientId, setPatientId] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [recipients, setRecipients] = useState<SmsRecipient[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<SmsMessage | null>(null);
  const [sandbox, setSandbox] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [sendError, setSendError] = useState('');
  const [success, setSuccess] = useState('');
  const recipientRequestRef = useRef(0);

  const parts = useMemo(() => countSmsParts(body), [body]);
  const eligibleCount = patients.length;
  const needsConfirmation = kind !== 'single';
  const canSend =
    !!body.trim() &&
    isWithinSmsPartLimit(body) &&
    !sending &&
    (kind === 'single' ? !!patientId : eligibleCount > 0);

  async function loadHistory() {
    const { data, error } = await createClient()
      .from('sms_messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    setMessages((data as SmsMessage[]) ?? []);
  }

  useEffect(() => {
    let active = true;

    async function load() {
      const supabase = createClient();
      const [statusResult, patientsResult, messagesResult] = await Promise.all([
        supabase.functions.invoke<{ sandbox?: boolean; error?: string }>('sms-send', {
          body: { action: 'status' },
        }),
        supabase
          .from('patients')
          .select('id, name, phone')
          .eq('do_not_message', false)
          .order('name'),
        supabase.from('sms_messages').select('*').order('created_at', { ascending: false }),
      ]);

      if (!active) return;

      if (statusResult.error) {
        setStatusError(
          await invokeErrorMessage(statusResult.error, 'Could not check SMS configuration.')
        );
      } else if (statusResult.data?.error) {
        setStatusError(statusResult.data.error);
      } else {
        setSandbox(!!statusResult.data?.sandbox);
      }

      const errors = [patientsResult.error?.message, messagesResult.error?.message].filter(Boolean);
      setLoadError(errors.join(' '));
      if (!patientsResult.error) setPatients((patientsResult.data as Patient[]) ?? []);
      if (!messagesResult.error) setMessages((messagesResult.data as SmsMessage[]) ?? []);
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  function changeKind(next: string) {
    const nextKind = next as MessageKind;
    setKind(nextKind);
    setSendError('');
    setSuccess('');
    if (nextKind === 'feedback_invite') setBody(pickFeedbackInviteBody());
  }

  async function sendMessage() {
    if (!canSend) return;
    setSending(true);
    setSendError('');
    setSuccess('');

    const { data, error } = await createClient().functions.invoke<SendResult>('sms-send', {
      body: {
        action: 'send',
        kind,
        body: body.trim(),
        patientId: kind === 'single' ? patientId : undefined,
      },
    });

    setSending(false);
    if (error) {
      setSendError(await invokeErrorMessage(error, 'Could not send SMS.'));
      return;
    }
    if (data?.error) {
      setSendError(data.error);
      return;
    }

    setSuccess(
      `Send complete: ${data?.sentCount ?? 0} sent, ${data?.failedCount ?? 0} failed out of ${data?.recipientCount ?? 0}.`
    );
    try {
      await loadHistory();
    } catch (historyError) {
      setLoadError(historyError instanceof Error ? historyError.message : 'Could not refresh history.');
    }
  }

  async function selectMessage(message: SmsMessage) {
    const requestId = ++recipientRequestRef.current;
    setSelectedMessage(message);
    setRecipients([]);
    setRecipientLoading(true);
    setLoadError('');
    const { data, error } = await createClient()
      .from('sms_recipients')
      .select('id, phone, status, error, cost')
      .eq('message_id', message.id)
      .order('status');
    if (requestId !== recipientRequestRef.current) return;
    setRecipientLoading(false);
    if (error) {
      setLoadError(error.message);
      return;
    }
    setRecipients((data as SmsRecipient[]) ?? []);
  }

  return (
    <>
      <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div>
          <h2 className="font-heading text-2xl font-extrabold tracking-tight">Messages</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Send patient SMS and review delivery results.
          </p>
        </div>

        {sandbox ? (
          <Alert className="border-amber-300 bg-amber-50 text-amber-950">
            <AlertTitle>Test mode (Africa&apos;s Talking sandbox)</AlertTitle>
            <AlertDescription>
              Messages are sent to the sandbox simulator, not to real phones.
            </AlertDescription>
          </Alert>
        ) : null}
        {statusError ? (
          <Alert variant="destructive">
            <AlertTitle>SMS status unavailable</AlertTitle>
            <AlertDescription>{statusError}</AlertDescription>
          </Alert>
        ) : null}
        {loadError ? (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Compose message</CardTitle>
            <CardDescription>
              Eligible recipients exclude patients marked do not message.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Tabs value={kind} onValueChange={(value) => changeKind(value ?? 'broadcast')}>
              <TabsList className="grid h-auto w-full grid-cols-3 sm:w-fit">
                <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
                <TabsTrigger value="single">Single</TabsTrigger>
                <TabsTrigger value="feedback_invite">Feedback invite</TabsTrigger>
              </TabsList>
            </Tabs>

            {kind === 'single' ? (
              <div className="grid gap-2">
                <Label htmlFor="message-patient">Patient</Label>
                <Select value={patientId} onValueChange={(value) => setPatientId(value ?? '')}>
                  <SelectTrigger id="message-patient" className="w-full sm:max-w-md">
                    <SelectValue placeholder="Select an eligible patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.name} · {patient.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {loading
                  ? 'Loading eligible recipients…'
                  : `${eligibleCount} eligible patient${eligibleCount === 1 ? '' : 's'}`}
              </p>
            )}

            {kind === 'feedback_invite' && !isWithinSmsPartLimit(FEEDBACK_INVITE_BOTH) ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBody(FEEDBACK_INVITE_OUTPATIENT)}
                >
                  Outpatient template
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBody(FEEDBACK_INVITE_INPATIENT)}
                >
                  Inpatient template
                </Button>
              </div>
            ) : null}

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="message-body">Message</Label>
                <span
                  className={`text-xs font-medium ${parts.parts > 3 ? 'text-destructive' : 'text-muted-foreground'}`}
                >
                  {parts.parts}/3 parts · {parts.encoding.toUpperCase()}
                </span>
              </div>
              <textarea
                id="message-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={5}
                placeholder="Write your message"
                className="min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              {parts.parts > 3 ? (
                <p className="text-xs text-destructive">Shorten this message to 3 SMS parts or fewer.</p>
              ) : null}
            </div>

            {sendError ? (
              <Alert variant="destructive">
                <AlertDescription>{sendError}</AlertDescription>
              </Alert>
            ) : null}
            {success ? (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            ) : null}

            <Button
              disabled={!canSend}
              onClick={() => (needsConfirmation ? setConfirmOpen(true) : sendMessage())}
            >
              <Send data-icon="inline-start" />
              {sending ? 'Sending…' : 'Send message'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Message history</CardTitle>
            <CardDescription>Choose a message to inspect recipient delivery results.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Sent / Failed / Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((message) => (
                  <TableRow
                    key={message.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`Inspect ${kindLabel(message.kind)} sent ${new Date(message.created_at).toLocaleString()}`}
                    className="cursor-pointer"
                    data-state={selectedMessage?.id === message.id ? 'selected' : undefined}
                    onClick={() => selectMessage(message)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        selectMessage(message);
                      }
                    }}
                  >
                    <TableCell>{new Date(message.created_at).toLocaleString()}</TableCell>
                    <TableCell>{kindLabel(message.kind)}</TableCell>
                    <TableCell className="max-w-sm truncate" title={message.body}>
                      {message.body}
                    </TableCell>
                    <TableCell>
                      <Badge variant={message.status === 'failed' ? 'destructive' : 'secondary'}>
                        {message.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {message.sent_count} / {message.failed_count} / {message.recipient_count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!loading && !messages.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No messages sent yet.</p>
            ) : null}
          </CardContent>
        </Card>

        {selectedMessage ? (
          <Card>
            <CardHeader>
              <CardTitle>Recipients</CardTitle>
              <CardDescription>
                Delivery details for {kindLabel(selectedMessage.kind).toLowerCase()} sent{' '}
                {new Date(selectedMessage.created_at).toLocaleString()}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipients.map((recipient) => (
                    <TableRow key={recipient.id}>
                      <TableCell className="font-medium">{recipient.phone}</TableCell>
                      <TableCell>
                        <Badge variant={recipient.status === 'failed' ? 'destructive' : 'secondary'}>
                          {recipient.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{recipient.cost ?? '—'}</TableCell>
                      <TableCell className="max-w-md whitespace-normal">
                        {recipient.error ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!recipientLoading && !recipients.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No recipient records found.
                </p>
              ) : null}
              {recipientLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Loading recipients…
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </main>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send to {eligibleCount} patients?</AlertDialogTitle>
            <AlertDialogDescription>
              This {kindLabel(kind).toLowerCase()} will be sent to every eligible patient. Patients
              marked do not message are excluded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={sending}
              onClick={(event) => {
                event.preventDefault();
                setConfirmOpen(false);
                sendMessage();
              }}
            >
              {sending ? 'Sending…' : `Send to ${eligibleCount}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
