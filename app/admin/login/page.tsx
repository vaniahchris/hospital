'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@ndejjehealth.org');
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
    <main className="login-page">
      <section className="login-story">
        <Link href="/" className="login-brand">
          <span>+</span>
          <div>
            <strong>Ndejje Health Centre</strong>
            <small>Care Today. A Healthier Tomorrow</small>
          </div>
        </Link>
        <div className="login-message">
          <span className="login-kicker">FEEDBACK ADMINISTRATION</span>
          <h1>Turn every response into better care.</h1>
          <p>Review patient experiences, discover trends, and improve the questions that matter most.</p>
          <div className="login-stat">
            <strong>Live</strong>
            <span>connected to Supabase</span>
          </div>
        </div>
        <p className="login-quote">Together for a Healthier Community</p>
      </section>
      <section className="login-form-side">
        <form className="login-card" onSubmit={submit}>
          <div className="login-mobile-brand"><span>+</span>Ndejje Health</div>
          <span className="login-lock">🔐</span>
          <h2>Welcome back</h2>
          <p>Sign in to manage feedback and view analytics.</p>
          <label htmlFor="admin-email">Email address</label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
          <label htmlFor="admin-password">Password</label>
          <div className="password-field">
            <input
              id="admin-password"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
            <button type="button" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
          </div>
          {error && <p className="login-preview" role="alert">{error}</p>}
          <div className="login-options">
            <label><input type="checkbox" /> Remember me</label>
            <button type="button">Forgot password?</button>
          </div>
          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in to dashboard'}
            <span>→</span>
          </button>
          <Link href="/" className="login-back">← Back to feedback form</Link>
        </form>
      </section>
    </main>
  );
}
