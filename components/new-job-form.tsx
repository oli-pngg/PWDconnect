'use client';

import { ArrowLeft, CheckCircle2, FilePlus2, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Skill } from '@/lib/types';
import { isValidOccupationalQuestionCount, MAX_OCCUPATIONAL_QUESTIONS, MIN_OCCUPATIONAL_QUESTIONS } from '@/lib/assessment-rules';
import { MAX_REQUIRED_JOB_SKILLS } from '@/lib/skill-rules';

type QuestionDraft = {
  prompt: string;
  options: string[];
  correctOption: string;
  skillId: string;
  points: string;
};

const blankQuestion = (): QuestionDraft => ({ prompt: '', options: ['', '', '', ''], correctOption: '', skillId: '', points: '1' });

export function NewJobForm() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillSearches, setSkillSearches] = useState<Record<string, string>>({});
  const [questions, setQuestions] = useState<QuestionDraft[]>(() => Array.from({ length: MIN_OCCUPATIONAL_QUESTIONS }, blankQuestion));
  const [form, setForm] = useState({ title: '', description: '', assessmentCategory: '', location: 'Legazpi City, Albay', workMode: 'Flexible', employmentType: 'Full-time', salaryMin: '', salaryMax: '', accommodations: '', status: 'draft' });
  const [loading, setLoading] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const groupedSkills = useMemo(() => skills.reduce<Record<string, Skill[]>>((groups, skill) => {
    (groups[skill.category] ??= []).push(skill);
    return groups;
  }, {}), [skills]);

  useEffect(() => {
    fetch('/api/skills', { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json() as { skills?: Skill[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to load skills.');
      setSkills(payload.skills ?? []);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load skills.')).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/employer/verification', { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json() as { verification?: { status?: string } };
      if (response.ok) setVerificationStatus(payload.verification?.status ?? null);
    }).catch(() => setVerificationStatus(null));
  }, []);

  function setField(field: keyof typeof form, value: string) { setForm((current) => ({ ...current, [field]: value })); }

  function toggleSkill(id: string) {
    setError('');
    setSelectedSkills((current) => {
      if (current.includes(id)) return current.filter((skillId) => skillId !== id);
      return current.length < MAX_REQUIRED_JOB_SKILLS ? [...current, id] : current;
    });
  }

  function setSkillSearch(category: string, value: string) {
    setSkillSearches((current) => ({ ...current, [category]: value }));
  }

  function setQuestionField(index: number, field: keyof QuestionDraft, value: string) {
    setQuestions((current) => current.map((question, questionIndex) => questionIndex === index ? { ...question, [field]: value } : question));
  }

  function setQuestionOption(questionIndex: number, optionIndex: number, value: string) {
    setQuestions((current) => current.map((question, index) => {
      if (index !== questionIndex) return question;
      const options = question.options.map((option, itemIndex) => itemIndex === optionIndex ? value : option);
      return { ...question, options, correctOption: question.correctOption === question.options[optionIndex] ? value : question.correctOption };
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!form.title.trim() || form.title.trim().length < 3) { setError('Enter a job title with at least 3 characters.'); return; }
    if (!form.description.trim() || form.description.trim().length < 20) { setError('Add a description with at least 20 characters.'); return; }
    if (form.assessmentCategory.trim().length < 2) { setError('Add an assessment category such as Barista, Web development, or Graphic design.'); return; }
    if (!selectedSkills.length) { setError('Select at least one required skill.'); return; }
    if (form.status === 'published' && verificationStatus !== 'approved') { setError('You can save a draft now; approval is required before publishing.'); return; }
    if (form.salaryMin && form.salaryMax && Number(form.salaryMin) > Number(form.salaryMax)) { setError('The minimum salary cannot be greater than the maximum salary.'); return; }
    if (!isValidOccupationalQuestionCount(questions.length)) { setError(`Add ${MIN_OCCUPATIONAL_QUESTIONS} to ${MAX_OCCUPATIONAL_QUESTIONS} assessment questions.`); return; }
    if (questions.some((question) => question.prompt.trim().length < 3 || question.options.filter(Boolean).length < 2 || new Set(question.options.filter(Boolean)).size !== question.options.filter(Boolean).length || !question.correctOption || !question.options.includes(question.correctOption) || !question.skillId)) {
      setError('Complete every assessment question with at least two options, a correct answer, and a related job skill.');
      return;
    }

    setPending(true);
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          salaryMin: Number(form.salaryMin),
          salaryMax: Number(form.salaryMax),
          skillIds: selectedSkills,
          assessmentQuestions: questions.map((question) => ({ ...question, options: question.options.filter(Boolean), points: Number(question.points) }))
        })
      });
      const payload = await response.json() as { jobId?: string; error?: string };
      if (!response.ok) setError(payload.error || 'Unable to create opening.');
      else {
        setSuccess(form.status === 'published' ? 'Opening published with its assessment category and questions.' : 'Draft saved with its assessment category and questions.');
        setForm((current) => ({ ...current, title: '', description: '', assessmentCategory: '', accommodations: '' }));
        setSelectedSkills([]);
        setQuestions(Array.from({ length: MIN_OCCUPATIONAL_QUESTIONS }, blankQuestion));
      }
    } catch {
      setError('The server could not be reached. Check that the development server is running, then try again.');
    } finally {
      setPending(false);
    }
  }

  if (loading) return <div className="panel"><span className="skeleton skeleton-title" /></div>;

  return <>
    <div className="page-heading"><div><p className="eyebrow">New opening</p><h1>Post an opening.</h1></div><Link className="button secondary small" href="/employer/jobs"><ArrowLeft size={15} aria-hidden="true" /> Back</Link></div>
    <form className="panel form-stack" onSubmit={submit} noValidate>
       <div className="panel-header"><div><h2>Opening details</h2><p>Skills and assessment power matching.</p></div><FilePlus2 size={20} aria-hidden="true" /></div>
       {verificationStatus === 'approved' ? <div className="form-success" role="status">Employer verification approved. You may publish after completing the opening requirements.</div> : <div className="notice" role="status">You may prepare and save draft openings. Only approved employers can publish new vacancies.</div>}
      <div className="field-grid two">
        <label className="field" htmlFor="job-title"><span>Job title</span><input className="input" id="job-title" value={form.title} onChange={(event) => setField('title', event.target.value)} maxLength={120} minLength={3} required placeholder="For example: Barista" /></label>
        <label className="field" htmlFor="assessment-category"><span>Assessment category</span><input className="input" id="assessment-category" value={form.assessmentCategory} onChange={(event) => setField('assessmentCategory', event.target.value)} maxLength={80} required placeholder="For example: Barista" /><small>Use the same category name for related openings.</small></label>
      </div>
      <div className="field-grid two">
        <label className="field" htmlFor="employment-type"><span>Employment type</span><select className="select" id="employment-type" value={form.employmentType} onChange={(event) => setField('employmentType', event.target.value)}><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option></select></label>
        <label className="field" htmlFor="job-status"><span>Opening status</span><select className="select" id="job-status" value={verificationStatus === 'approved' ? form.status : 'draft'} onChange={(event) => setField('status', event.target.value)}><option value="draft">Save as draft</option>{verificationStatus === 'approved' ? <option value="published">Publish now</option> : null}</select></label>
      </div>
      <label className="field" htmlFor="job-description"><span>What will this person do?</span><textarea className="textarea" id="job-description" value={form.description} onChange={(event) => setField('description', event.target.value)} minLength={20} maxLength={5000} required placeholder="List the regular tasks, expected outcomes, and tools. Avoid requirements that are not needed for the work." /></label>
      <div className="field-grid two">
        <label className="field" htmlFor="job-location"><span>Location</span><input className="input" id="job-location" value={form.location} onChange={(event) => setField('location', event.target.value)} maxLength={120} /></label>
        <label className="field" htmlFor="job-work-mode"><span>Work mode</span><select className="select" id="job-work-mode" value={form.workMode} onChange={(event) => setField('workMode', event.target.value)}><option>Flexible</option><option>On-site</option><option>Hybrid</option><option>Remote</option></select></label>
      </div>
      <div className="field-grid two">
        <label className="field" htmlFor="salary-min"><span>Minimum salary <small>(optional)</small></span><input className="input" id="salary-min" type="number" min="0" value={form.salaryMin} onChange={(event) => setField('salaryMin', event.target.value)} /></label>
        <label className="field" htmlFor="salary-max"><span>Maximum salary <small>(optional)</small></span><input className="input" id="salary-max" type="number" min="0" value={form.salaryMax} onChange={(event) => setField('salaryMax', event.target.value)} /></label>
      </div>
      <label className="field" htmlFor="job-accommodations"><span>Accessibility and accommodations <small>(optional)</small></span><textarea className="textarea" id="job-accommodations" value={form.accommodations} onChange={(event) => setField('accommodations', event.target.value)} maxLength={1000} placeholder="Describe available accommodations, communication options, or flexible arrangements." /></label>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend>Required skills</legend>
        <p className="field-help">Choose up to {MAX_REQUIRED_JOB_SKILLS} skills that are genuinely needed for this role. They drive the fit score and connect assessment answers to verified skills. {selectedSkills.length}/{MAX_REQUIRED_JOB_SKILLS} selected.</p>
        <div className="skill-category-list">
          {Object.entries(groupedSkills).map(([category, categorySkills]) => {
            const search = (skillSearches[category] ?? '').trim().toLowerCase();
            const visibleSkills = search
              ? categorySkills.filter((skill) => skill.name.toLowerCase().includes(search))
              : categorySkills;

            return (
              <section className="skill-category-group" aria-label={category} key={category}>
                <h3 className="skill-category-heading">{category}</h3>
                <label className="skill-category-search">
                  <span className="sr-only">Search {category} skills</span>
                  <input
                    className="input"
                    type="search"
                    aria-label={`Search ${category} skills`}
                    placeholder={`Search ${category} skills`}
                    value={skillSearches[category] ?? ''}
                    onChange={(event) => setSkillSearch(category, event.target.value)}
                  />
                </label>
                {visibleSkills.length ? (
                  <div className="skill-picker">
                    {visibleSkills.map((skill) => (
                      <label key={skill.id}>
                        <input
                          type="checkbox"
                          checked={selectedSkills.includes(skill.id)}
                          disabled={!selectedSkills.includes(skill.id) && selectedSkills.length >= MAX_REQUIRED_JOB_SKILLS}
                          onChange={() => toggleSkill(skill.id)}
                        />
                        <span>{skill.name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="skill-category-empty" role="status">No skills match this search.</p>
                )}
              </section>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend>Occupational skills assessment</legend>
        <p className="field-help">Add at least five job-related questions. Candidates receive up to six.</p>
        <div className="form-stack">
          {questions.map((question, questionIndex) => <div className="panel" key={questionIndex}>
            <div className="panel-header"><div><h3>Question {questionIndex + 1}</h3><p>Map the question to one job skill.</p></div>{questions.length > MIN_OCCUPATIONAL_QUESTIONS ? <button className="button danger small" type="button" onClick={() => setQuestions((current) => current.filter((_, index) => index !== questionIndex))}><Trash2 size={14} aria-hidden="true" /> Remove</button> : null}</div>
            <label className="field" htmlFor={`assessment-prompt-${questionIndex}`}><span>Question prompt</span><textarea className="textarea" id={`assessment-prompt-${questionIndex}`} value={question.prompt} onChange={(event) => setQuestionField(questionIndex, 'prompt', event.target.value)} maxLength={1000} required placeholder="What would you do first when..." /></label>
            <div className="field-grid two">
              {question.options.map((option, optionIndex) => <label className="field" htmlFor={`assessment-option-${questionIndex}-${optionIndex}`} key={optionIndex}><span>Option {optionIndex + 1}</span><input className="input" id={`assessment-option-${questionIndex}-${optionIndex}`} value={option} onChange={(event) => setQuestionOption(questionIndex, optionIndex, event.target.value)} maxLength={300} required={optionIndex < 2} /></label>)}
            </div>
            <div className="field-grid two">
              <label className="field" htmlFor={`assessment-correct-${questionIndex}`}><span>Correct answer</span><select className="select" id={`assessment-correct-${questionIndex}`} value={question.correctOption} onChange={(event) => setQuestionField(questionIndex, 'correctOption', event.target.value)} required><option value="">Choose an option</option>{question.options.filter(Boolean).map((option, optionIndex) => <option key={`${option}-${optionIndex}`} value={option}>{option}</option>)}</select></label>
              <label className="field" htmlFor={`assessment-skill-${questionIndex}`}><span>Verified skill</span><select className="select" id={`assessment-skill-${questionIndex}`} value={question.skillId} onChange={(event) => setQuestionField(questionIndex, 'skillId', event.target.value)} required><option value="">Choose a required skill</option>{skills.filter((skill) => selectedSkills.includes(skill.id)).map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></label>
            </div>
            <label className="field" htmlFor={`assessment-points-${questionIndex}`}><span>Points</span><input className="input" id={`assessment-points-${questionIndex}`} type="number" min="1" max="10" value={question.points} onChange={(event) => setQuestionField(questionIndex, 'points', event.target.value)} /></label>
          </div>)}
        </div>
        <button className="button secondary small" type="button" disabled={questions.length >= MAX_OCCUPATIONAL_QUESTIONS} onClick={() => setQuestions((current) => [...current, blankQuestion()])}><Plus size={15} aria-hidden="true" /> Add question</button>
      </fieldset>
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      {success ? <div className="form-success" role="status"><CheckCircle2 size={16} aria-hidden="true" /> {success}</div> : null}
      <div className="button-row"><button className="button" type="submit" disabled={pending}>{pending ? 'Saving...' : form.status === 'published' ? 'Publish opening' : 'Save draft'} <CheckCircle2 size={16} aria-hidden="true" /></button><span className="field-help">Assessment answers are scored privately on the server.</span></div>
    </form>
  </>;
}
