'use client';

import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/skeleton';
import type { AssessmentQuestion } from '@/lib/types';

type Attempt = { score: number; total_points: number; completed_at: string };

export function AssessmentView() {
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [latest, setLatest] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Attempt | null>(null);

  useEffect(() => {
    fetch('/api/assessment', { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json() as { questions?: AssessmentQuestion[]; latestAttempt?: Attempt | null; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to load assessment.');
      setQuestions(payload.questions ?? []);
      setLatest(payload.latestAttempt ?? null);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load assessment.')).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="assessment-layout"><div className="assessment-card"><div className="skeleton-stack"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line short" /></div></div><div className="skeleton-card"><Skeleton className="skeleton-title" /></div></div>;
  if (error) return <div className="form-error" role="alert">{error}</div>;
  if (!questions.length) return <div className="empty-state"><h3>Assessment content is not configured.</h3><p>Run the supplied Supabase migration to seed the accessible assessment questions.</p></div>;

  const current = questions[index];
  const answeredCount = Object.keys(answers).length;
  const isLast = index === questions.length - 1;

  async function submit() {
    if (answeredCount !== questions.length) {
      setError('Answer every question before submitting. Use the progress indicator to find the unanswered items.');
      return;
    }
    setPending(true);
    setError('');
    const response = await fetch('/api/assessment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ responses: questions.map((question) => ({ questionId: question.id, selectedOption: answers[question.id] })), accommodationNotes: notes }) });
    const payload = await response.json() as { attempt?: Attempt; error?: string };
    if (!response.ok) setError(payload.error || 'Unable to submit assessment.');
    else if (payload.attempt) { setResult(payload.attempt); setLatest(payload.attempt); }
    setPending(false);
  }

  if (result) {
    const percentage = result.total_points ? Math.round((result.score / result.total_points) * 100) : 0;
    return <div className="content-grid equal"><section className="assessment-card panel-accent"><p className="eyebrow">Assessment complete</p><h2 style={{ marginTop: 10 }}>Your skills have more signal now.</h2><div className="fit-score large" aria-label={`${percentage} percent assessment score`}>{percentage}%</div><p className="muted">{result.score} of {result.total_points} points. Verified skill tags from this attempt now help rank your recommendations.</p><a className="button secondary" href="/jobs">See recommended work <ArrowRight size={16} aria-hidden="true" /></a></section><section className="panel"><div className="panel-header"><div><h2>What happens next?</h2><p>Keep control of the details you share.</p></div><CheckCircle2 size={21} aria-hidden="true" /></div><ul className="mini-list"><li><CheckCircle2 size={17} aria-hidden="true" /><div><strong>Scores become verified signals</strong><span>Employers see skill evidence, not disability labels, in initial screening.</span></div></li><li><CheckCircle2 size={17} aria-hidden="true" /><div><strong>You can update your profile</strong><span>Self-reported skills and work preferences remain editable.</span></div></li><li><CheckCircle2 size={17} aria-hidden="true" /><div><strong>Nothing guarantees a hire</strong><span>Recommendations support decisions; they do not promise employment.</span></div></li></ul></section></div>;
  }

  return <>
    <div className="page-heading"><div><p className="eyebrow">Integrated skill-based assessment</p><h1>Show how you work.</h1><p>Six short questions. No forced countdown. Choose the answer that best reflects a practical work habit.</p></div><div className="notice"><Clock3 size={15} aria-hidden="true" /> No mandatory timer</div></div>
    <div className="assessment-layout"><section className="assessment-card" aria-labelledby="question-heading"><div className="assessment-progress"><span>Question {index + 1} of {questions.length}</span><div className="meter" aria-hidden="true"><span style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div><span>{answeredCount}/{questions.length} answered</span></div><p className="question-number">Practical judgment</p><h2 id="question-heading">{current.prompt}</h2><fieldset className="option-list" style={{ border: 0, padding: 0, margin: 0 }}><legend className="sr-only">Select one answer</legend>{current.options.map((option, optionIndex) => <div className="option" key={option}><input id={`question-${current.id}-${optionIndex}`} type="radio" name={`question-${current.id}`} checked={answers[current.id] === option} onChange={() => setAnswers((previous) => ({ ...previous, [current.id]: option }))} /><label htmlFor={`question-${current.id}-${optionIndex}`}>{option}</label></div>)}</fieldset><div className="assessment-actions"><button className="button secondary small" type="button" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}><ArrowLeft size={15} aria-hidden="true" /> Previous</button>{isLast ? <button className="button small" type="button" disabled={pending} onClick={submit}>{pending ? 'Scoring...' : 'Submit assessment'} <CheckCircle2 size={15} aria-hidden="true" /></button> : <button className="button small" type="button" onClick={() => setIndex((value) => Math.min(questions.length - 1, value + 1))}>Next <ArrowRight size={15} aria-hidden="true" /></button>}</div><div className="sr-status" role="status" aria-live="polite">{error}</div></section><aside className="panel" aria-labelledby="assessment-support-heading"><div className="panel-header"><div><h2 id="assessment-support-heading">Choose what helps</h2><p>Accommodations are part of valid assessment.</p></div><Info size={20} aria-hidden="true" /></div><p className="small-text muted">You can use a screen reader, keyboard, zoom, captions, or another assistive tool. Tell us about timing or format support below; this note is used for research and assessment context.</p><label className="field" htmlFor="accommodation-notes"><span>Optional accommodation note</span><textarea className="textarea" id="accommodation-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="For example: I used extra time or a keyboard-only workflow." /></label>{latest ? <div className="notice" style={{ marginTop: 18 }}><strong>Previous attempt: {latest.total_points ? Math.round((latest.score / latest.total_points) * 100) : 0}%</strong><br />You can retake the assessment when your skills change.</div> : null}</aside></div>
  </>;
}
