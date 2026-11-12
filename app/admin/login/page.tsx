'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace('/admin');
    });
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.replace('/admin');
  }

  return (
    <main className="grid min-h-svh bg-background lg:grid-cols-[minmax(320px,38%)_1fr]">
      <section className="hidden flex-col bg-primary px-10 py-10 text-primary-foreground lg:flex">
        <Link href="/" className="flex items-center gap-3 text-primary-foreground">
          <img
            src="/value-family-hospital-logo.png"
            alt="Value Family Hospital logo"
            className="size-10 rounded-full object-cover"
          />
          <span>
            <strong className="block text-sm font-semibold">Value Family Hospital</strong>
            <small className="text-[10px] text-primary-foreground/80">Kitende · Feedback Admin</small>
          </span>
        </Link>
        <div className="my-auto max-w-sm space-y-3">
          <h1 className="text-3xl font-semibold text-balance">Sign in to manage feedback</h1>
          <p className="text-sm leading-relaxed text-primary-foreground/85">
            Review responses, update questions, and message patients.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/70">Service with a difference</p>
      </section>

      <section className="flex items-center justify-center bg-background p-6 md:p-10">
        <Card className="w-full max-w-md border shadow-none">
          <CardHeader className="space-y-1">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary lg:hidden">
              <img
                src="/value-family-hospital-logo.png"
                alt="Value Family Hospital logo"
                className="size-8 rounded-full object-cover"
              />
              Value Family Hospital
            </div>
            <CardTitle className="text-xl font-semibold">Welcome back</CardTitle>
            <CardDescription>Sign in to manage feedback and view analytics.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={submit}>
              <div className="grid gap-2">
                <Label htmlFor="admin-email">Email address</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="admin-password">Password</Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-1 right-1"
                    onClick={() => setShow(!show)}
                    aria-label={show ? 'Hide password' : 'Show password'}
                  >
                    {show ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </div>
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
                {!loading ? <ArrowRight data-icon="inline-end" /> : null}
              </Button>
              <Button variant="link" className="text-muted-foreground" asChild>
                <Link href="/">
                  <ArrowLeft data-icon="inline-start" />
                  Back to feedback form
                </Link>
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
