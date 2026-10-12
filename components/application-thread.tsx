'use client';

import { ArrowLeft, Check, MessageCircle, Send, ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { StatusPill } from '@/components/status-pill';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { ApplicationStatus, JobOffer, Message, OfferStatus } from '@/lib/types';

type ThreadData = {
  viewerId: string;
  participantRole: 'candidate' | 'employer';
  application: { id: string; jobId: string; jobTitle: string; status: ApplicationStatus; participantLabel: string };
  messages: Message[];
  offer: JobOffer | null;
};

async function fetchThread(applicationId: string) {
  const response = await fetch(`/api/applications/${applicationId}/messages`, { cache: 'no-store' });
  const payload = await response.json() as ThreadData & { error?: string };
  if (!response.ok) throw new Error(payload.error || 'Unable to load this conversation.');
  return payload;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function offerLabel(status: OfferStatus) {
  if (status === 'accepted') return 'Offer accepted';
  if (status === 'declined') return 'Offer declined';
  if (status === 'withdrawn') return 'Offer withdrawn';
  return 'Offer pending';
}

export function ApplicationThread({ applicationId }: { applicationId: string }) {
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [offerMessage, setOfferMessage] = useState('');
  const [compensation, setCompensation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [offerBusy, setOfferBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    void fetchThread(applicationId).then((data) => {
      if (active) setThread(data);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load this conversation.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [applicationId]);

  useEffect(() => {
    const viewerId = thread?.viewerId;
    if (!viewerId) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`application-thread-${applicationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `application_id=eq.${applicationId}` }, (payload) => {
        const incoming = payload.new as Message;
        setThread((current) => current && current.messages.some((item) => item.id === incoming.id) ? current : current ? { ...current, messages: [...current.messages, incoming] } : current);
        if (incoming.sender_id !== viewerId) setNotice('New message received.');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_offers', filter: `application_id=eq.${applicationId}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setThread((current) => current ? { ...current, offer: null } : current);
          setNotice('Offer removed.');
          return;
        }
        const incoming = payload.new as JobOffer;
        setThread((current) => current ? { ...current, offer: incoming } : current);
        setNotice(`Offer update: ${offerLabel(incoming.status)}.`);
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') void fetchThread(applicationId).then(setThread).catch(() => setNotice('Live updates are unavailable. Refresh to reconnect.'));
      });
    return () => { void supabase.removeChannel(channel); };
  }, [applicationId, thread?.viewerId]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const response = await fetch(`/api/applications/${applicationId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
      const payload = await response.json() as { message?: Message; error?: string };
      if (!response.ok || !payload.message) throw new Error(payload.error || 'Unable to send your message.');
      setThread((current) => current && current.messages.some((item) => item.id === payload.message?.id) ? current : current ? { ...current, messages: [...current.messages, payload.message as Message] } : current);
      setMessage('');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Unable to send your message.');
    } finally {
      setSending(false);
    }
  }

  async function sendOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!offerMessage.trim() || offerBusy) return;
    setOfferBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/applications/${applicationId}/offer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: offerMessage, compensation, startDate }) });
      const payload = await response.json() as { offer?: JobOffer; error?: string };
      if (!response.ok || !payload.offer) throw new Error(payload.error || 'Unable to send the job offer.');
      setThread((current) => current ? { ...current, offer: payload.offer as JobOffer } : current);
      setOfferMessage('');
      setCompensation('');
      setStartDate('');
      setNotice('Job offer sent.');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Unable to send the job offer.');
    } finally {
      setOfferBusy(false);
    }
  }

  async function updateOffer(status: 'accepted' | 'declined' | 'withdrawn') {
    if (!thread?.offer || offerBusy) return;
    setOfferBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/offers/${thread.offer.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      const payload = await response.json() as { offer?: JobOffer; applicationStatus?: ApplicationStatus; error?: string };
      if (!response.ok || !payload.offer) throw new Error(payload.error || 'Unable to update the offer.');
      setThread((current) => current ? { ...current, offer: payload.offer as JobOffer, application: { ...current.application, status: payload.applicationStatus ?? current.application.status } } : current);
      setNotice(offerLabel(status));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Unable to update the offer.');
    } finally {
      setOfferBusy(false);
    }
  }

  if (loading) return <div className="skeleton-card" aria-busy="true"><span className="skeleton skeleton-title" /><span className="skeleton skeleton-line" /></div>;
  if (error && !thread) return <div className="form-error" role="alert">{error} <button className="button secondary small" type="button" onClick={() => window.location.reload()}>Retry</button></div>;
  if (!thread) return null;

  const canRespond = thread.participantRole === 'candidate' && thread.offer?.status === 'pending';
  const canWithdraw = thread.participantRole === 'employer' && thread.offer?.status === 'pending';

  return <>
    <div className="thread-back"><Link className="text-link" href="/messages"><ArrowLeft size={16} aria-hidden="true" /> Back</Link></div>
    <div className="page-heading thread-heading"><div><p className="eyebrow">Application</p><h1>{thread.application.jobTitle}</h1><p>{thread.application.participantLabel} / <StatusPill status={thread.application.status} /></p></div><div className="notice"><ShieldCheck size={16} aria-hidden="true" /> Private thread</div></div>
    {notice ? <div className="form-success" role="status" aria-live="polite">{notice}</div> : null}
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    <div className="thread-layout">
      <section className="panel thread-panel" aria-labelledby="conversation-heading">
        <div className="panel-header"><div><h2 id="conversation-heading">Conversation</h2><p>Keep messages clear and respectful.</p></div><MessageCircle size={20} aria-hidden="true" /></div>
        <div className="message-list" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation messages">{thread.messages.length ? thread.messages.map((item) => <article className={`message-bubble ${item.sender_id === thread.viewerId ? 'own' : 'incoming'}`} key={item.id}><p>{item.body}</p><footer>{item.sender_id === thread.viewerId ? 'You' : thread.application.participantLabel} / {formatDate(item.created_at)}</footer></article>) : <div className="empty-state compact"><MessageCircle size={26} aria-hidden="true" /><p>No messages yet.</p></div>}</div>
        <form className="message-composer" onSubmit={sendMessage}><label className="sr-only" htmlFor="message-body">Write a message</label><textarea className="textarea" id="message-body" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={4000} placeholder="Write a message..." rows={4} /><div className="composer-footer"><span className="small-text muted">{message.length}/4000</span><button className="button" type="submit" disabled={sending || !message.trim()}>{sending ? 'Sending...' : 'Send'} <Send size={16} aria-hidden="true" /></button></div></form>
      </section>
      <aside className="panel offer-panel" aria-labelledby="offer-heading">
        <div className="panel-header"><div><p className="eyebrow">Hiring</p><h2 id="offer-heading">Job offer</h2></div>{thread.offer ? <StatusPill status={thread.offer.status} /> : <span className="tag">No offer yet</span>}</div>
        {thread.offer ? <div className="offer-card"><p>{thread.offer.message}</p>{thread.offer.compensation ? <dl className="offer-details"><div><dt>Compensation</dt><dd>{thread.offer.compensation}</dd></div>{thread.offer.start_date ? <div><dt>Start date</dt><dd>{thread.offer.start_date}</dd></div> : null}</dl> : thread.offer.start_date ? <dl className="offer-details"><div><dt>Start date</dt><dd>{thread.offer.start_date}</dd></div></dl> : null}<p className="small-text muted">Sent {formatDate(thread.offer.created_at)} / {offerLabel(thread.offer.status)}</p>{canRespond ? <div className="button-row"><button className="button" type="button" disabled={offerBusy} onClick={() => void updateOffer('accepted')}><Check size={16} aria-hidden="true" /> Accept</button><button className="button danger" type="button" disabled={offerBusy} onClick={() => void updateOffer('declined')}><X size={16} aria-hidden="true" /> Decline</button></div> : null}{canWithdraw ? <button className="button danger small" type="button" disabled={offerBusy} onClick={() => void updateOffer('withdrawn')}>Withdraw</button> : null}</div> : thread.participantRole === 'employer' ? <form className="form-stack" onSubmit={sendOffer}><p className="muted">Send an offer after reviewing this application.</p><div className="field"><label htmlFor="offer-message">Offer message</label><textarea className="textarea" id="offer-message" value={offerMessage} onChange={(event) => setOfferMessage(event.target.value)} maxLength={4000} rows={5} placeholder="Why this candidate fits..." required /></div><div className="field"><label htmlFor="offer-compensation">Compensation <small>(optional)</small></label><input className="input" id="offer-compensation" value={compensation} onChange={(event) => setCompensation(event.target.value)} maxLength={200} placeholder="For example: PHP 25,000 / month" /></div><div className="field"><label htmlFor="offer-start-date">Start date <small>(optional)</small></label><input className="input" id="offer-start-date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div><button className="button" type="submit" disabled={offerBusy || !offerMessage.trim()}>{offerBusy ? 'Sending...' : 'Send offer'} <Send size={16} aria-hidden="true" /></button></form> : <div className="empty-state compact"><p>Waiting for the employer.</p></div>}
      </aside>
    </div>
  </>;
}
