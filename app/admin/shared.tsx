'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function AdminIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    dashboard:<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    questions:<><path d="M6 3h12a2 2 0 0 1 2 2v16l-5-3-5 3-6-3V5a2 2 0 0 1 2-2Z"/><path d="M8 8h8M8 12h6"/></>,
    responses:<><path d="M4 19V9m5 10V5m5 14v-7m5 7V3"/></>,
    people:<><circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-7 7-7s7 3 7 7m0-10c3 0 6 2 6 6"/></>,
    export:<><path d="M12 3v12m-4-4 4 4 4-4"/><path d="M5 20h14"/></>,
    edit:<><path d="m4 20 4-1 11-11-3-3L5 16l-1 4Z"/></>,
    trash:<><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/></>,
    plus:<><path d="M12 5v14M5 12h14"/></>
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function AdminShell({ children, title }: { children: React.ReactNode; title: string }) {
  const path = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(()=>{if(sessionStorage.getItem('ndejje-admin-session')!=='active'){router.replace('/admin/login')}else{setReady(true)}},[router]);
  const links = [{href:'/admin',label:'Overview',icon:'dashboard'},{href:'/admin/questions',label:'Questions',icon:'questions'},{href:'/admin/responses',label:'Responses',icon:'responses'}];
  const active = (href:string) => href === '/admin' ? path === href : path.startsWith(href);
  function logout(){sessionStorage.removeItem('ndejje-admin-session');router.replace('/admin/login')}
  if(!ready)return <div className="admin-loading"><span/></div>;
  return <div className="admin-root"><aside className="admin-sidebar"><Link href="/" className="admin-logo"><span className="admin-logo-mark">+</span><span><strong>Ndejje Health</strong><small>FEEDBACK ADMIN</small></span></Link><nav className="admin-nav">{links.map(link=><Link className={active(link.href)?'active':''} href={link.href} key={link.href}><AdminIcon name={link.icon}/>{link.label}</Link>)}</nav><nav className="mobile-menu">{links.map(link=><Link className={active(link.href)?'active':''} href={link.href} key={link.href}>{link.label}</Link>)}<button className="mobile-signout" onClick={logout}>Sign out</button></nav><div className="admin-side-bottom"><Link href="/" className="admin-preview-link">View feedback form ↗</Link><div className="admin-profile"><span className="admin-avatar">A</span><span><strong>Administrator</strong><small>Hospital admin</small></span><button className="logout-button" onClick={logout} title="Sign out" aria-label="Sign out">↪</button></div></div></aside><div className="admin-main"><header className="admin-topbar"><h1>{title}</h1><div className="topbar-actions"><span className="admin-live"><i/> System live</span><button className="topbar-logout" onClick={logout}>Sign out</button></div></header>{children}</div></div>;
}

export const responses = [
  {id:'FB-1048',date:'Today, 10:42 AM',care:'Excellent',staff:'Excellent',wait:'Very short',recommend:'Definitely',score:5,comment:'The nurse was very kind and explained everything clearly.'},
  {id:'FB-1047',date:'Today, 9:18 AM',care:'Very Good',staff:'Excellent',wait:'Short',recommend:'Definitely',score:4.8,comment:'Quick service and a clean environment.'},
  {id:'FB-1046',date:'Yesterday, 4:31 PM',care:'Good',staff:'Very Good',wait:'Reasonable',recommend:'Probably',score:4.1,comment:'More seating in the waiting area would help.'},
  {id:'FB-1045',date:'Yesterday, 1:02 PM',care:'Excellent',staff:'Excellent',wait:'Long',recommend:'Definitely',score:4.4,comment:'Great doctors, though the pharmacy queue was long.'},
  {id:'FB-1044',date:'Sep 18, 11:27 AM',care:'Fair',staff:'Good',wait:'Long',recommend:'Not sure',score:3.2,comment:'Please communicate delays to patients.'},
];
