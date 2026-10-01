'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  ExternalLink,
  LogOut,
  Menu,
  UserCog,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

const links = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/questions', label: 'Questions', icon: ListChecks },
  { href: '/admin/responses', label: 'Responses', icon: MessageSquareText },
] as const;

export function AdminShell({ children, title }: { children: React.ReactNode; title: string }) {
  const path = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('Administrator');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function check() {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data.user) {
        router.replace('/admin/login');
        return;
      }
      setEmail(data.user.email ?? 'Administrator');
      setReady(true);
    }

    check();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/admin/login');
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  const active = (href: string) => (href === '/admin' ? path === href : path.startsWith(href));

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/admin/login');
  }

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40">
        <Skeleton className="size-8 rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-muted/40 md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-sidebar-border bg-sidebar md:sticky md:top-0 md:flex md:h-svh md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-4 md:px-5">
          <Link href="/" className="flex items-center gap-3 text-primary">
            <img
              src="/value-family-hospital-logo.png"
              alt="Value Family Hospital logo"
              className="size-9 rounded-full object-cover"
            />
            <span className="min-w-0">
              <strong className="block font-heading text-sm font-extrabold tracking-tight text-foreground">
                Value Family Hospital
              </strong>
              <small className="text-[10px] tracking-wide text-muted-foreground uppercase">
                Feedback Admin
              </small>
            </span>
          </Link>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            <Menu />
          </Button>
        </div>

        <nav className={cn('flex flex-col gap-1 px-3 pb-4', mobileOpen ? 'flex' : 'hidden md:flex')}>
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = active(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'
                )}
              >
                <Icon className="size-4" />
                {link.label}
              </Link>
            );
          })}
          <Button
            type="button"
            variant="ghost"
            className="mt-1 justify-start md:hidden"
            onClick={() => {
              setMobileOpen(false);
              setAccountOpen(true);
            }}
          >
            <UserCog className="size-4" />
            Account settings
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="justify-start text-destructive md:hidden"
            onClick={logout}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </nav>

        <div className="mt-auto hidden flex-col gap-3 p-4 md:flex">
          <Button variant="outline" className="w-full justify-between" asChild>
            <Link href="/">
              View feedback form
              <ExternalLink className="size-3.5" />
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={() => setAccountOpen(true)}
          >
            <UserCog className="size-3.5" />
            Account settings
          </Button>
          <Separator />
          <div className="flex items-center gap-3">
            <Avatar size="sm">
              <AvatarFallback className="bg-primary/10 text-primary">
                {email.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">Administrator</p>
              <p className="truncate text-[10px] text-muted-foreground">{email}</p>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" onClick={logout} aria-label="Sign out">
              <LogOut className="size-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 hidden h-16 items-center justify-between border-b bg-background px-8 md:flex">
          <h1 className="font-heading text-lg font-bold tracking-tight">{title}</h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5 bg-emerald-50 text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              System live
            </Badge>
            <Button type="button" variant="outline" size="sm" onClick={() => setAccountOpen(true)}>
              <UserCog data-icon="inline-start" />
              Account
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={logout}>
              Sign out
            </Button>
          </div>
        </header>
        {children}
      </div>

      <AccountSettingsDialog
        email={email}
        open={accountOpen}
        onOpenChange={setAccountOpen}
        onEmailUpdated={setEmail}
      />
    </div>
  );
}

function AccountSettingsDialog({
  email,
  open,
  onOpenChange,
  onEmailUpdated,
}: {
  email: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEmailUpdated: (email: string) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextEmail, setNextEmail] = useState(email);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (open) setNextEmail(email);
  }, [open, email]);

  function resetForm() {
    setCurrentPassword('');
    setNextEmail(email);
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
    setLoading(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const trimmedEmail = nextEmail.trim().toLowerCase();
    const emailChanged = trimmedEmail !== email.toLowerCase();
    const passwordChanged = !!newPassword || !!confirmPassword;

    if (!emailChanged && !passwordChanged) {
      setError('Update your email, password, or both before saving.');
      return;
    }

    if (emailChanged && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    if (passwordChanged) {
      if (newPassword.length < 8) {
        setError('New password must be at least 8 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('New password and confirmation do not match.');
        return;
      }
      if (newPassword === currentPassword) {
        setError('New password must be different from the current password.');
        return;
      }
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error: invokeError } = await supabase.functions.invoke<{
      error?: string;
      email?: string;
      passwordUpdated?: boolean;
      emailUpdated?: boolean;
    }>('admin-account', {
      body: {
        currentPassword,
        email: emailChanged ? trimmedEmail : undefined,
        password: passwordChanged ? newPassword : undefined,
      },
    });

    setLoading(false);

    if (invokeError) {
      let message = invokeError.message || 'Could not update account settings.';
      try {
        const context = invokeError as { context?: Response };
        if (context.context) {
          const payload = (await context.context.json()) as { error?: string };
          if (payload?.error) message = payload.error;
        }
      } catch {
        if (typeof data?.error === 'string') message = data.error;
      }
      setError(message);
      return;
    }

    if (data?.error) {
      setError(data.error);
      return;
    }

    const messages: string[] = [];
    if (data?.passwordUpdated) messages.push('Password updated.');
    if (data?.emailUpdated) {
      messages.push('Email updated.');
      onEmailUpdated(data.email ?? trimmedEmail);
    }

    setSuccess(messages.join(' ') || 'Account updated.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Account settings</DialogTitle>
          <DialogDescription>
            Change your sign-in email and/or password. Changes apply immediately. Current password is
            required.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="account-email">Email</Label>
            <Input
              id="account-email"
              type="email"
              autoComplete="username"
              value={nextEmail}
              onChange={(e) => setNextEmail(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <Separator />
          <p className="text-xs text-muted-foreground">
            Leave the new password fields blank if you only want to change your email.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
            />
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
