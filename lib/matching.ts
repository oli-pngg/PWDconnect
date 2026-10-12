import type { CandidateSkill, Job, JobSkill } from '@/lib/types';

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizedSkillName(skill: JobSkill | CandidateSkill) {
  const value = one(skill.skills);
  return value?.name ?? skill.skill_id;
}

export function calculateFitScore(job: Job, candidateSkills: CandidateSkill[], candidateLocation?: string) {
  const required = job.job_skills ?? [];
  if (!required.length) {
    return {
      score: 0,
      matched: [],
      missing: [],
      verified: [],
      hasVerifiedEvidence: false,
      reason: 'Add required skills to calculate a transparent fit score.'
    };
  }

  const candidateBySkill = new Map(candidateSkills.map((skill) => [skill.skill_id, skill]));
  const totalWeight = required.reduce((sum, skill) => sum + Math.max(skill.importance ?? 1, 1), 0);
  let matchedWeight = 0;
  const matched: string[] = [];
  const missing: string[] = [];
  const verified: string[] = [];

  required.forEach((requiredSkill) => {
    const candidateSkill = candidateBySkill.get(requiredSkill.skill_id);
    if (!candidateSkill) {
      missing.push(normalizedSkillName(requiredSkill));
      return;
    }

    const weight = Math.max(requiredSkill.importance ?? 1, 1);
    const levelRatio = Math.min(candidateSkill.proficiency / Math.max(requiredSkill.required_level ?? 1, 1), 1);
    matchedWeight += weight * levelRatio;
    matched.push(normalizedSkillName(requiredSkill));
    if (candidateSkill.source === 'assessment_verified' && candidateSkill.proficiency >= 3) {
      verified.push(normalizedSkillName(requiredSkill));
    }
  });

  const skillScore = (matchedWeight / totalWeight) * 75;
  const verificationScore = (verified.length / required.length) * 15;
  const locationScore = candidateLocation && job.location && candidateLocation.toLowerCase() === job.location.toLowerCase() ? 10 : 0;
  const score = Math.round(Math.min(skillScore + verificationScore + locationScore, 100));

  const reasonParts = [];
  if (matched.length) reasonParts.push(`${matched.length} of ${required.length} required skills align`);
  if (missing.length) reasonParts.push(`missing ${missing.join(', ')}`);
  if (verified.length) reasonParts.push(`verified through assessment: ${verified.join(', ')}`);
  else reasonParts.push('complete the accessible assessment to verify competency');
  if (locationScore) reasonParts.push('location preference aligns');

  return {
    score,
    matched,
    missing,
    verified,
    hasVerifiedEvidence: verified.length > 0,
    reason: reasonParts.length ? reasonParts.join('; ') + '.' : 'Build your skill profile to improve this match.'
  };
}

export function rankJobs(jobs: Job[], candidateSkills: CandidateSkill[], candidateLocation?: string) {
  return jobs
    .map((job) => {
      const result = calculateFitScore(job, candidateSkills, candidateLocation);
      return {
        ...job,
        fit_score: result.score,
        matched_skills: result.matched,
        missing_skills: result.missing,
        verified_skills: result.verified,
        has_verified_evidence: result.hasVerifiedEvidence,
        match_reason: result.reason
      };
    })
    .sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0));
}
