'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { RAND36_SCALES, RAND36_SECTIONS } from '@/lib/rand36';

type Rand36Result = {
  id: string;
  instrument_version: string;
  language: string;
  scoring_method: string;
  health_change_response: number | null;
  health_change_score: number | null;
  completed_at: string;
  scales: Array<{ scale_code: string; score: number | null; answered_items: number; item_count: number }>;
};

type Rand36Payload = { available?: boolean; consentGranted?: boolean; latestAttempt?: Rand36Result | null; error?: string };

const itemTwo = RAND36_SECTIONS.flatMap((section) => section.items).find((item) => item.number === 2)!;
const totalRand36Items = RAND36_SECTIONS.reduce((total, section) => total + section.items.length, 0);

function countAnsweredItems(attempt: Rand36Result | null) {
  if (!attempt) return 0;
  const scaleItemsAnswered = attempt.scales.reduce((total, scale) => total + scale.answered_items, 0);
  return scaleItemsAnswered + (attempt.health_change_response == null ? 0 : 1);
}

export function Rand36Assessment({ onContinue }: { onContinue: () => void }) {
  const idPrefix = `rand36-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const titleId = `${idPrefix}-title`;
  const surveyHeadingId = `${idPrefix}-survey-heading`;
  const keyboardInstructionsId = `${idPrefix}-keyboard-instructions`;
  const unansweredNoteId = `${idPrefix}-unanswered-note`;
  const scoreSummaryId = `${idPrefix}-score-summary`;
  const [consent, setConsent] = useState(false);
  const [available, setAvailable] = useState(false);
  const [consentGranted, setConsentGranted] = useState(false);
  const [latest, setLatest] = useState<Rand36Result | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [selectionConfirmation, setSelectionConfirmation] = useState<{ questionNumber: number; label: string } | null>(null);
  const [unansweredQuestionNumber, setUnansweredQuestionNumber] = useState<number | null>(null);
  const [takingSurvey, setTakingSurvey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const resultHeading = useRef<HTMLHeadingElement | null>(null);
  const surveyHeading = useRef<HTMLHeadingElement | null>(null);
  const focusResultsAfterTransition = useRef(false);
  const focusSurveyAfterTransition = useRef(false);

  useEffect(() => {
    let active = true;
    fetch('/api/rand36', { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json() as Rand36Payload;
      if (!response.ok) throw new Error(payload.error || 'RAND-36 is unavailable.');
      if (!active) return;
      setAvailable(payload.available === true);
      setConsentGranted(payload.consentGranted === true);
      setLatest(payload.latestAttempt ?? null);
      setTakingSurvey(false);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'RAND-36 is unavailable.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!focusResultsAfterTransition.current || !latest || takingSurvey) return;
    focusResultsAfterTransition.current = false;
    resultHeading.current?.focus();
  }, [latest, takingSurvey]);

  useEffect(() => {
    if (!focusSurveyAfterTransition.current || !takingSurvey) return;
    focusSurveyAfterTransition.current = false;
    surveyHeading.current?.focus();
  }, [takingSurvey]);

  function beginSurvey() {
    focusSurveyAfterTransition.current = true;
    setSelectionConfirmation(null);
    setUnansweredQuestionNumber(null);
    setTakingSurvey(true);
  }

  function navigateRadioChoices(event: React.KeyboardEvent<HTMLInputElement>, questionNumber: number) {
    if (event.key !== 'Tab') return;
    const currentRadio = event.currentTarget;
    const choices = Array.from(currentRadio.form?.querySelectorAll<HTMLInputElement>('input[type="radio"]') ?? [])
      .filter((radio) => radio.name === currentRadio.name);
    const currentIndex = choices.indexOf(currentRadio);
    const nextChoice = choices[currentIndex + (event.shiftKey ? -1 : 1)];
    const hasAnswer = answers[String(questionNumber)] != null;

    if (hasAnswer) return;
    if (nextChoice) {
      event.preventDefault();
      nextChoice.focus();
      return;
    }
    if (event.shiftKey) return;

    event.preventDefault();
    setUnansweredQuestionNumber(questionNumber);
    choices[0]?.focus();
  }

  async function changeConsent(granted: boolean) {
    setPending(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/rand36/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ granted })
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to save your consent choice.');
      setConsentGranted(granted);
      setAvailable(true);
      setConsent(false);
      if (granted) {
        beginSurvey();
        setNotice('Consent saved. RAND-36 results remain private to you.');
      } else {
        setLatest(null);
        setTakingSurvey(false);
        setAnswers({});
        setSelectionConfirmation(null);
        setNotice('Consent withdrawn. Saved RAND-36 responses and scores were erased.');
      }
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Unable to save your consent choice.');
    } finally {
      setPending(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/rand36', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: answers })
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to save RAND-36 results.');
      const resultResponse = await fetch('/api/rand36', { cache: 'no-store' });
      const resultPayload = await resultResponse.json() as Rand36Payload;
      if (!resultResponse.ok) throw new Error(resultPayload.error || 'Unable to load RAND-36 results.');
      const savedAttempt = resultPayload.latestAttempt ?? null;
      if (savedAttempt) focusResultsAfterTransition.current = true;
      setLatest(savedAttempt);
      setTakingSurvey(false);
      setAnswers({});
      setSelectionConfirmation(null);
      setNotice('RAND-36 results saved to your private profile.');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit RAND-36.');
    } finally {
      setPending(false);
    }
  }

  if (loading) return <div className="panel" role="status" aria-live="polite">Loading RAND-36...</div>;

  const answered = Object.keys(answers).length;
  const unanswered = totalRand36Items - answered;
  const unansweredQuestion = unansweredQuestionNumber == null
    ? null
    : RAND36_SECTIONS.flatMap((section) => section.items).find((item) => item.number === unansweredQuestionNumber) ?? null;
  const latestAnswered = countAnsweredItems(latest);
  const latestUnanswered = totalRand36Items - latestAnswered;
  const healthChange = latest?.health_change_response == null
    ? null
    : itemTwo?.options.find((option) => option.code === latest.health_change_response)?.label ?? null;

  return <section className="rand36-section" aria-labelledby={titleId} lang="en">
    <div className="page-heading"><div><p className="eyebrow">Health-related quality of life</p><h1 id={titleId}>RAND 36-Item Health Survey</h1><p>Separate from occupational skills and job-fit scores.</p></div>{available ? <span className="status-pill published">Available</span> : null}</div>
    <p className="small-text muted">RAND 36-Item Health Survey Version 1.0, developed at RAND as part of the Medical Outcomes Study. Official English form. <a href="https://www.rand.org/health/surveys/mos/36-item-short-form/scoring.html" target="_blank" rel="noreferrer">Scoring instructions</a> / <a href="https://www.rand.org/health/surveys/mos/36-item-short-form/terms.html" target="_blank" rel="noreferrer">Terms</a>.</p>
    {notice ? <div className="form-success" role="status">{notice}</div> : null}
    {error ? <div className="form-error" role="alert">{error}</div> : null}

    {error && !consentGranted ? <div className="panel"><p className="muted">RAND-36 is unavailable right now. You can continue to the separate occupational skills quiz.</p><button className="button secondary" type="button" onClick={onContinue}>Continue to occupational assessment</button></div> : null}

    {!error && !consentGranted ? <div className="panel rand36-consent">
      <h2>Before you begin</h2>
      <p>This survey records health-related quality-of-life answers. With consent, responses and eight separate scale scores are stored for you to review. They are not a diagnosis, are not used for job ranking, and are not shared with employers.</p>
      <label className="checkbox-line"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I consent to processing and storing my RAND-36 responses for my private results.</span></label>
      <div className="button-row"><button className="button" type="button" disabled={!consent || pending} onClick={() => void changeConsent(true)}>{pending ? 'Saving...' : 'Start Health Assessment'}</button><button className="button secondary" type="button" onClick={onContinue}>Continue without RAND-36</button></div>
    </div> : null}

    {!error && consentGranted && !latest && !takingSurvey ? <div className="panel rand36-consent"><h2>RAND-36 is available</h2><p>Your responses will stay private and will not affect job ranking.</p><div className="button-row"><button className="button" type="button" onClick={() => beginSurvey()}>Start Health Assessment</button><button className="button secondary" type="button" onClick={onContinue}>Continue to occupational assessment</button><button className="button secondary" type="button" onClick={() => void changeConsent(false)} disabled={pending}>Withdraw consent</button></div></div> : null}

     {consentGranted && latest && !takingSurvey ? <div className="panel rand36-results">
       <h2 ref={resultHeading} tabIndex={-1} aria-describedby={scoreSummaryId}>Your eight health scale scores</h2>
       <p id={scoreSummaryId}>Scores range from 0–100; higher means more favorable health status. No combined total is calculated. {latestAnswered} of {totalRand36Items} questions answered ({latestUnanswered} unanswered). Unanswered items were omitted from their scale means.</p>
       <div className="table-wrap"><table className="data-table" aria-describedby={scoreSummaryId}><caption className="sr-only">RAND-36 Version 1.0 scale scores</caption><thead><tr><th scope="col">Health scale</th><th scope="col">Score</th><th scope="col">Items answered</th></tr></thead><tbody>{latest.scales.map((scale) => <tr key={scale.scale_code}><th scope="row">{RAND36_SCALES.find((item) => item.code === scale.scale_code)?.label ?? scale.scale_code}</th><td data-label="Score">{scale.score == null ? 'Not scored' : Number(scale.score).toFixed(2)}</td><td data-label="Items answered">{scale.answered_items} / {scale.item_count}</td></tr>)}</tbody></table></div>
      <div className="notice rand36-change"><strong>Health change compared with one year ago:</strong> {healthChange ?? 'Not answered'}{latest.health_change_score == null ? '' : ` (separate item score: ${Number(latest.health_change_score).toFixed(2)})`}</div>
        <div className="button-row"><button className="button secondary" type="button" onClick={beginSurvey}>Retake Health Assessment</button><button className="button secondary" type="button" onClick={() => void changeConsent(false)} disabled={pending}>Withdraw consent and erase results</button><button className="button" type="button" onClick={onContinue}>Continue to occupational assessment</button></div>
     </div> : null}

    {consentGranted && takingSurvey ? <form className="panel rand36-form" onSubmit={submit} aria-labelledby={surveyHeadingId} aria-describedby={`${keyboardInstructionsId} ${unansweredNoteId}`}>
        <div className="panel-header"><div><h2 id={surveyHeadingId} ref={surveyHeading} tabIndex={-1} aria-describedby={`${keyboardInstructionsId} ${unansweredNoteId}`}>Survey items</h2><p id={keyboardInstructionsId}>Use Tab to focus each question and its answer choices. If no answer is selected, Tab moves through choices; arrow keys also move through them. Press Space to select. After answering, Tab moves to the next question.</p><p id={unansweredNoteId}>Unanswered items are omitted from their scale mean.</p></div><span className="tag" role="status" aria-live="polite" aria-atomic="true">{answered} of {totalRand36Items} questions answered. {unanswered} unanswered.</span></div>
        {selectionConfirmation ? <div className="form-success" role="status" aria-live="polite" aria-atomic="true">Question {selectionConfirmation.questionNumber}: {selectionConfirmation.label} selected.</div> : null}
        {unansweredQuestion ? <p className="form-error" id={`${idPrefix}-unanswered-question-error`} role="alert" aria-atomic="true">Select one response before moving on.<span className="sr-only">Question {unansweredQuestion.number}: {unansweredQuestion.prompt} Available choices: {unansweredQuestion.options.map((option) => option.label).join('; ')}.</span></p> : null}
       {RAND36_SECTIONS.map((section, sectionIndex) => {
         const sectionHeadingId = `${idPrefix}-group-${sectionIndex}`;
         const instructionsId = `${idPrefix}-section-instructions-${sectionIndex}`;
         return (
           <section className="rand36-group" aria-labelledby={sectionHeadingId} key={section.title + sectionIndex}>
             <h3 id={sectionHeadingId}>{section.title}</h3>
             {section.instructions ? <p className="field-help" id={instructionsId}>{section.instructions}</p> : null}
             {section.items.map((item) => (
               <fieldset className="rand36-item" key={item.number} aria-invalid={unansweredQuestionNumber === item.number ? 'true' : undefined} aria-describedby={section.instructions ? instructionsId : undefined}>
                  <legend tabIndex={0} onFocus={() => setSelectionConfirmation(null)}>{item.number}. {item.prompt}</legend>
                 <div className="rand36-options">
                   {item.options.map((option) => {
                     const optionId = `${idPrefix}-answer-${item.number}-${option.code}`;
                     return (
                       <label className="radio-line" htmlFor={optionId} key={option.code}>
                          <input id={optionId} type="radio" name={`rand36-item-${item.number}`} value={option.code} checked={answers[String(item.number)] === option.code} onChange={() => { setAnswers((current) => ({ ...current, [item.number]: option.code })); setSelectionConfirmation({ questionNumber: item.number, label: option.label }); setUnansweredQuestionNumber(null); }} onKeyDown={(event) => navigateRadioChoices(event, item.number)} />
                         <span>{option.label}</span>
                       </label>
                     );
                   })}
                 </div>
               </fieldset>
             ))}
           </section>
         );
       })}
       <p className="small-text muted">Scoring: RAND 36-Item Health Survey Version 1.0. Item 2 is reported separately. No universal total score is calculated.</p>
       <div className="button-row">{latest ? <button className="button secondary" type="button" disabled={pending} onClick={() => { focusResultsAfterTransition.current = true; setTakingSurvey(false); }}>Back to results</button> : <button className="button secondary" type="button" onClick={onContinue}>Continue without RAND-36</button>}<button className="button secondary" type="button" disabled={pending} onClick={() => void changeConsent(false)}>Withdraw consent and erase results</button><button className="button" type="submit" disabled={pending}>{pending ? 'Scoring...' : 'Save RAND-36 results'}</button></div>
     </form> : null}
  </section>;
}
