import type { GenderOption } from '@/lib/profile-options';

export type UserRole = 'candidate' | 'employer' | 'admin';
export type JobStatus = 'draft' | 'published' | 'closed';
export type ApplicationStatus = 'submitted' | 'shortlisted' | 'interview' | 'rejected' | 'hired';
export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn';

export type Profile = {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  organization_name: string | null;
  gender: GenderOption | null;
  headline: string | null;
  bio: string | null;
  disability_description: string | null;
  location: string | null;
  work_mode: string;
  availability: string;
  years_experience: number;
  disability_types: string[];
  accessibility_needs: string[];
  profile_photo_url: string | null;
  profile_photo_alt: string | null;
  profile_photo_path?: string | null;
  profile_completed: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Skill = {
  id: string;
  slug: string;
  name: string;
  category: string;
};

export type JobSkill = {
  skill_id: string;
  required_level: number;
  importance: number;
  skills?: Skill | Skill[] | null;
};

export type Job = {
  id: string;
  employer_id: string;
  title: string;
  description: string;
  location: string;
  work_mode: string;
  employment_type: string;
  salary_min: number | null;
  salary_max: number | null;
  accommodations: string | null;
  assessment_category: string;
  status: JobStatus;
  created_at: string;
  job_skills?: JobSkill[];
  organization_name?: string | null;
  fit_score?: number;
  matched_skills?: string[];
  missing_skills?: string[];
  verified_skills?: string[];
  has_verified_evidence?: boolean;
  assessment_required?: boolean;
  match_reason?: string;
  application_status?: ApplicationStatus | null;
};

export type CandidateSkill = {
  skill_id: string;
  proficiency: number;
  source: string;
  skills?: Skill | Skill[] | null;
};

export type AssessmentQuestion = {
  id: string;
  job_id?: string | null;
  assessment_category: string;
  skill_id: string;
  prompt: string;
  options: string[];
  points: number;
  sort_order: number;
};

export type CandidatePreview = {
  application_id: string;
  job_id: string;
  job_title: string;
  candidate_ref: string;
  fit_score: number;
  matched_skills: string[];
  missing_skills?: string[];
  verified_skills?: string[];
  has_verified_evidence?: boolean;
  match_reason?: string;
  status: ApplicationStatus;
  created_at: string;
};

export type Message = {
  id: string;
  application_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type JobOffer = {
  id: string;
  application_id: string;
  job_id: string;
  employer_id: string;
  candidate_id: string;
  message: string;
  compensation: string | null;
  start_date: string | null;
  status: OfferStatus;
  created_at: string;
  responded_at: string | null;
};

export type ConversationSummary = {
  application_id: string;
  job_id: string;
  job_title: string;
  participant_label: string;
  application_status: ApplicationStatus;
  last_message: Message | null;
  unread_count: number;
  offer_status: OfferStatus | null;
};
