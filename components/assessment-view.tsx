'use client';

import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Info } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/skeleton';
import type { AssessmentQuestion } from '@/lib/types';

type Attempt = { score: number; total_points: number; completed_at: string; assessment_category?: string | null; job_id?: string | null };
type AssessmentJob = { id: string; title: string; assessment_category: string };
type AssessmentPayload = { jobs?: AssessmentJob[]; selectedJob?: AssessmentJob | null; categories?: string[]; selectedCategory?: string | null; assessmentToken?: string | null; questions?: AssessmentQuestion[]; latestAttempt?: Attempt | null; error?: string };

export function AssessmentView() {
  const [categories, setCategories] = useState<string[]>([]);
  const [jobs, setJobs] = useState<AssessmentJob[]>([]);
  const [jobId, setJobId] = useState('');
  const [category, setCategory] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [assessmentToken, setAssessmentToken] = useState('');
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [latest, setLatest] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [questionError, setQuestionError] = useState('');
  const [selectionConfirmation, setSelectionConfirmation] = useState<{ questionNumber: number; label: string } | null>(null);
  const [result, setResult] = useState<Attempt | null>(null);
  const [verifiedSkillCount, setVerifiedSkillCount] = useState(0);
  const questionHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const optionFieldsetRef = useRef<HTMLFieldSetElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const query = jobId
          ? `?jobId=${encodeURIComponent(jobId)}`
          : category
            ? `?category=${encodeURIComponent(category)}`
            : '';
        const response = await fetch(`/api/assessment${query}`, { cache: 'no-store' });
        const payload = await response.json() as AssessmentPayload;
        if (!response.ok) throw new Error(payload.error || 'Unable to load assessment.');
        if (cancelled) return;
        setJobs(payload.jobs ?? []);
        setCategories(payload.categories ?? []);
        setQuestions(payload.questions ?? []);
        setLatest(payload.latestAttempt ?? null);
        setSelectedCategory(payload.selectedCategory ?? '');
        setAssessmentToken(payload.assessmentToken ?? '');
        if (payload.selectedJob?.id && payload.selectedJob.id !== jobId) setJobId(payload.selectedJob.id);
      } catch (reason: unknown) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load assessment.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [category, jobId]);

  useEffect(() => {
    if (!loading && questions.length) questionHeadingRef.current?.focus({ preventScroll: false });
  }, [index, loading, questions.length]);

  function chooseCategory(value: string) {
    setJobId('');
    setCategory(value);
    setSelectedCategory('');
    setAssessmentToken('');
    setQuestions([]);
    setAnswers({});
    setIndex(0);
    setQuestionError('');
    setSelectionConfirmation(null);
    setResult(null);
    setVerifiedSkillCount(0);
    setError('');
  }

  function chooseJob(value: string) {
    setJobId(value);
    setCategory('');
    setSelectedCategory('');
    setAssessmentToken('');
    setQuestions([]);
    setAnswers({});
    setIndex(0);
    setQuestionError('');
    setSelectionConfirmation(null);
    setResult(null);
    setVerifiedSkillCount(0);
    setError('');
  }

  async function submit() {
    const unansweredIndex = questions.findIndex((question) => !answers[question.id]);
    if (unansweredIndex !== -1) {
      setQuestionError(`Select one response for question ${unansweredIndex + 1} before submitting.`);
      setSelectionConfirmation(null);
      if (unansweredIndex !== index) setIndex(unansweredIndex);
      requestAnimationFrame(() => optionFieldsetRef.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus());
      return;
    }
    setQuestionError('');
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/assessment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: jobId || undefined, assessmentCategory: selectedCategory, assessmentToken, responses: questions.map((question) => ({ questionId: question.id, selectedOption: answers[question.id] })), accommodationNotes: notes }) });
      const payload = await response.json() as { attempt?: Attempt; verifiedSkillCount?: number; error?: string };
      if (!response.ok) setError(payload.error || 'Unable to submit assessment.');
      else if (payload.attempt) { setResult(payload.attempt); setLatest(payload.attempt); setVerifiedSkillCount(payload.verifiedSkillCount ?? 0); }
    } catch {
      setError('The server could not be reached. Check that the development server is running, then try again.');
    } finally {
      setPending(false);
    }
  }

  if (loading && !categories.length) return <div className="assessment-layout"><div className="assessment-card"><div className="skeleton-stack"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line short" /></div></div><div className="skeleton-card"><Skeleton className="skeleton-title" /></div></div>;
  if (error && !categories.length) return <div className="form-error" role="alert">{error} <button className="button secondary small" type="button" onClick={() => window.location.reload()}>Retry</button></div>;

  if (result) {
    const percentage = result.total_points ? Math.round((result.score / result.total_points) * 100) : 0;
    return <div className="content-grid equal"><section className="assessment-card panel-accent"><p className="eyebrow">Occupational quiz result</p><h2 style={{ marginTop: 10 }}>Job-skill quiz complete.</h2><p className="notice">Category: {result.assessment_category || selectedCategory}</p><div className="fit-score large" aria-label={`${percentage} percent occupational quiz score`}>{percentage}%</div><p className="muted">{result.score} of {result.total_points} quiz points. {verifiedSkillCount ? `${verifiedSkillCount} job skill${verifiedSkillCount === 1 ? '' : 's'} met this quiz's verification rule.` : 'No job skill met this quiz’s verification rule.'} This is not an employability score.</p><button className="button secondary" type="button" onClick={() => chooseJob('')}>Choose another assessment <ArrowRight size={16} aria-hidden="true" /></button></section><section className="panel"><div className="panel-header"><div><h2>What happens next?</h2><p>Keep control of the details you share.</p></div><CheckCircle2 size={21} aria-hidden="true" /></div><p className="muted">Verified occupational skills can explain job matches. Employers make the final hiring decision.</p></section></div>;
  }

  const current = questions[index];
  const answeredCount = Object.keys(answers).length;
  const isLast = index === questions.length - 1;

  function focusFirstOption() {
    requestAnimationFrame(() => optionFieldsetRef.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus());
  }

  function nextQuestion() {
    if (!answers[current.id]) {
      setQuestionError(`Select one response for question ${index + 1} before moving to the next question.`);
      focusFirstOption();
      return;
    }
    setQuestionError('');
    setSelectionConfirmation(null);
    setIndex((value) => Math.min(questions.length - 1, value + 1));
  }

  function previousQuestion() {
    setQuestionError('');
    setSelectionConfirmation(null);
    setIndex((value) => Math.max(0, value - 1));
  }

  function navigateRadioChoices(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Tab') return;
    const currentRadio = event.currentTarget;
    const choices = Array.from(optionFieldsetRef.current?.querySelectorAll<HTMLInputElement>('input[type="radio"]') ?? []);
    const currentIndex = choices.indexOf(currentRadio);
    const nextChoice = choices[currentIndex + (event.shiftKey ? -1 : 1)];
    const hasAnswer = answers[current.id] != null;

    if (hasAnswer) return;
    if (nextChoice) {
      event.preventDefault();
      nextChoice.focus();
      return;
    }
    if (event.shiftKey) return;

    event.preventDefault();
    setQuestionError(`Select one response for question ${index + 1} before moving to the next question.`);
    choices[0]?.focus();
  }

  return <>
    <div className="page-heading"><div><p className="eyebrow">Occupational skills assessment</p><h1>Show your job skills.</h1><p>This job-specific quiz is separate from RAND-36 health results.</p></div><div className="notice"><Clock3 size={15} aria-hidden="true" /> No visible timer</div></div>
    <section className="panel" aria-labelledby="assessment-category-heading">
        <div className="panel-header"><div><h2 id="assessment-category-heading">Occupational skills assessment</h2><p>Job-related questions verify skills.</p></div><Info size={20} aria-hidden="true" /></div>
      {jobs.length ? <label className="field" htmlFor="assessment-job-select"><span>Choose an opening to assess</span><select className="select" id="assessment-job-select" value={jobId} onChange={(event) => chooseJob(event.target.value)}><option value="">Choose an opening</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title} / {job.assessment_category}</option>)}</select></label> : categories.length ? <label className="field" htmlFor="assessment-category-select"><span>Choose an assessment category</span><select className="select" id="assessment-category-select" value={category} onChange={(event) => chooseCategory(event.target.value)}><option value="">Choose a category</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label> : null}
      {(jobId || category) && loading ? <p className="field-help" role="status">Randomizing questions...</p> : null}
      {!jobs.length && !categories.length ? <p className="field-help">No employer assessment openings are available yet.</p> : null}
    </section>
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    {selectedCategory && !questions.length && !loading ? <div className="empty-state"><h3>No questions are available for this category.</h3><p>Choose another category or ask the employer to add questions.</p></div> : null}
    {questions.length ? (
      <div className="assessment-layout">
        <section className="assessment-card" aria-labelledby="question-heading">
          <div className="assessment-progress">
            <span>Question {index + 1} of {questions.length}</span>
            <div className="meter" role="progressbar" aria-label={`Question ${index + 1} of ${questions.length}`} aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={questions.length}>
              <span style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
            </div>
            <span role="status" aria-live="polite" aria-atomic="true">{answeredCount}/{questions.length} answered</span>
          </div>
          <p className="question-number">{selectedCategory}</p>
          <h2 id="question-heading" ref={questionHeadingRef} tabIndex={0} aria-describedby="assessment-keyboard-instructions">{current.prompt}</h2>
          <p className="field-help" id="assessment-keyboard-instructions">Use Tab to focus the question, then its choices. If no choice is selected, Tab moves through the choices. Arrow keys also move through them. Press Space to select. After selecting, Tab through the action buttons and activate Next to continue.</p>
          {selectionConfirmation ? <div className="form-success" role="status" aria-live="polite" aria-atomic="true">Question {selectionConfirmation.questionNumber}: {selectionConfirmation.label} selected.</div> : null}
          {questionError ? <p className="form-error" role="alert" aria-atomic="true">{questionError}<span className="sr-only">Question {index + 1}: {current.prompt} Available choices: {current.options.join('; ')}.</span></p> : null}
          <fieldset className="option-list" ref={optionFieldsetRef} aria-invalid={questionError ? 'true' : undefined} aria-describedby="assessment-keyboard-instructions" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="sr-only">Question {index + 1}: {current.prompt}. Select one answer.</legend>
            {current.options.map((option, optionIndex) => (
              <div className="option" key={`${option}-${optionIndex}`}>
                <input
                  id={`question-${current.id}-${optionIndex}`}
                  type="radio"
                  name={`question-${current.id}`}
                  checked={answers[current.id] === option}
                  onChange={() => {
                    setAnswers((previous) => ({ ...previous, [current.id]: option }));
                    setSelectionConfirmation({ questionNumber: index + 1, label: option });
                    setQuestionError('');
                  }}
                  onKeyDown={navigateRadioChoices}
                />
                <label htmlFor={`question-${current.id}-${optionIndex}`}>{option}</label>
              </div>
            ))}
          </fieldset>
          <div className="assessment-actions">
            <button className="button secondary small" type="button" disabled={index === 0} onClick={previousQuestion}><ArrowLeft size={15} aria-hidden="true" /> Previous</button>
            {isLast
              ? <button className="button small" type="button" disabled={pending} onClick={() => void submit()}>{pending ? 'Scoring...' : 'Submit assessment'} <CheckCircle2 size={15} aria-hidden="true" /></button>
              : <button className="button small" type="button" onClick={nextQuestion}>Next <ArrowRight size={15} aria-hidden="true" /></button>}
          </div>
          <div className="sr-status" role="status" aria-live="polite" aria-atomic="true">{error}</div>
        </section>
        <aside className="panel" aria-labelledby="assessment-support-heading">
          <div className="panel-header">
            <div><h2 id="assessment-support-heading">Assessment support</h2><p>Choose the access details that help you participate.</p></div>
            <Info size={20} aria-hidden="true" />
          </div>
          <label className="field" htmlFor="assessment-notes"><span>Accommodation notes <small>(optional)</small></span><textarea className="textarea" id="assessment-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} placeholder="For example: I prefer written instructions and extra reading time." /></label>
          {latest ? <div className="notice" style={{ marginTop: 16 }}><strong>Latest attempt: {latest.assessment_category || 'Assessment'}</strong><span> {latest.score} of {latest.total_points} points.</span></div> : null}
          <p className="field-help" style={{ marginTop: 16 }}>Your category result updates the same verified skill signals used by job recommendations.</p>
        </aside>
      </div>
    ) : null}
  </>;
}
