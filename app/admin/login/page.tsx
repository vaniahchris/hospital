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
    <main className="grid min-h-svh lg:grid-cols-[minmax(360px,42%)_1fr]">
      <section className="relative hidden flex-col overflow-hidden bg-primary px-12 py-10 text-primary-foreground lg:flex">
        <Link href="/" className="relative z-10 flex items-center gap-3 text-primary-foreground">
          <img
            src="/value-family-hospital-logo.png"
            alt="Value Family Hospital logo"
            className="size-10 rounded-full object-cover ring-2 ring-white/30"
          />
          <span>
            <strong className="block font-heading text-base font-extrabold">Value Family Hospital</strong>
            <small className="text-[10px] text-primary-foreground/80">Kitende · Service with a difference</small>
          </span>
        </Link>
        <div className="relative z-10 my-auto max-w-md">
          <p className="text-[10px] font-bold tracking-[0.2em] text-primary-foreground/75 uppercase">
            Feedback Administration
          </p>
          <h1 className="mt-4 font-heading text-4xl font-extrabold tracking-tight text-balance">
            Turn every response into better care.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-primary-foreground/85">
            Review patient experiences, discover trends, and improve the questions that matter most.
          </p>
          <BadgeLive />
        </div>
        <p className="relative z-10 font-serif text-sm text-primary-foreground/80 italic">
          Together for a Healthier Community
        </p>
      </section>

      <section className="flex items-center justify-center bg-muted/30 p-6 md:p-10">
        <Card className="w-full max-w-md shadow-sm">
          <CardHeader>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary lg:hidden">
              <img
                src="/value-family-hospital-logo.png"
                alt="Value Family Hospital logo"
                className="size-8 rounded-full object-cover"
              />
              Value Family Hospital
            </div>
            <CardTitle className="font-heading text-2xl font-extrabold tracking-tight">Welcome back</CardTitle>
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
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in to dashboard'}
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

function BadgeLive() {
  return (
    <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">
      <span className="size-1.5 rounded-full bg-emerald-300" />
      Live
    </div>
  );
}
