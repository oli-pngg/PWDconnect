'use client';

import { ArrowUpRight, Inbox, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StatusPill } from '@/components/status-pill';
import type { ConversationSummary } from '@/lib/types';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export function MessageInbox() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch('/api/messages', { cache: 'no-store' });
        const payload = await response.json() as { conversations?: ConversationSummary[]; error?: string };
        if (!response.ok) throw new Error(payload.error || 'Unable to load messages.');
        if (active) setConversations(payload.conversations ?? []);
      } catch (reason: unknown) {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load messages.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; document.removeEventListener('visibilitychange', refresh); };
  }, []);

  return <>
    <div className="page-heading">
      <div><p className="eyebrow">Direct conversations</p><h1>Messages that move work forward.</h1></div>
    </div>
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    {loading ? <div className="skeleton-card"><span className="skeleton skeleton-title" /><span className="skeleton skeleton-line" /></div> : conversations.length ? <section className="panel" aria-labelledby="conversation-list-heading">
      <div className="panel-header"><div><h2 id="conversation-list-heading">Your conversations</h2><p>Only the candidate and employer attached to an application can access its thread.</p></div><Inbox size={20} aria-hidden="true" /></div>
      <div className="conversation-list">{conversations.map((conversation) => <Link className="conversation-item" href={`/applications/${conversation.application_id}`} key={conversation.application_id}>
        <div className="conversation-item-main"><div className="conversation-item-heading"><h3>{conversation.job_title}</h3>{conversation.unread_count ? <span className="unread-badge">{conversation.unread_count} new</span> : null}</div><p>{conversation.participant_label}</p><span className="conversation-preview">{conversation.last_message?.body ?? (conversation.offer_status === 'pending' ? 'A job offer is waiting for a response.' : 'Start the conversation.')}</span></div>
        <div className="conversation-item-meta"><StatusPill status={conversation.offer_status ?? conversation.application_status} /><span>{conversation.last_message ? formatDate(conversation.last_message.created_at) : 'No messages'}</span><ArrowUpRight size={17} aria-hidden="true" /></div>
      </Link>)}</div>
    </section> : <section className="panel empty-state"><MessageCircle size={30} aria-hidden="true" /><h2>No conversations yet.</h2><p>Apply to an opening or review a candidate application to begin a secure thread.</p><Link className="button" href="/jobs">Explore openings <ArrowUpRight size={16} aria-hidden="true" /></Link></section>}
  </>;
}
