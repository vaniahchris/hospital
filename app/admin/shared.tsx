'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  ExternalLink,
  LogOut,
  Menu,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
            className="mt-1 justify-start text-destructive md:hidden"
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
            <Button type="button" variant="outline" size="sm" onClick={logout}>
              Sign out
            </Button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
