# PWD Connect Job Pairing Platform

PWD Connect is a deployable Next.js and Supabase implementation of the supplied thesis concept: an accessible, skills-first job pairing platform for persons with visual, hearing, and speech disabilities in Legazpi City and Albay.

## Included workflows

- Email/password registration, sign in, and password recovery for candidates and employers.
- A profile builder opens after sign in until the account has a complete profile for its role.
- Candidate profiles include a private PWD category, access description, experience, work mode, and optional profile photo with screen-reader alt text.
- Employer profiles include organization details, work mode, and an optional profile photo with screen-reader alt text.
- Candidate profile setup asks for a specific access profile: visual, hearing, speech, multiple, other, or prefer not to say.
- Server-verified sessions with protected dashboard routes.
- Candidate profile, skills, work preferences, and interaction preferences.
- Keyboard and screen-reader-friendly occupational skills quiz with no visible countdown, separate from RAND-36 health results.
- Separate RAND 36-Item Health Survey Version 1.0 workflow (official English items) with eight scale scores and a separately reported health-change item. Scores are applicant-only and are not used in job ranking; no Tagalog RAND translation is configured.
- Employer-authored job assessment banks require at least five questions; candidates receive up to six randomized questions per opening.
- Server-side assessment scoring; answer keys are never returned to the browser.
- When an opening is selected, its assessment result is recorded with that opening; only skills meeting the verification threshold influence recommendations and applications.
- Rule-based fit scoring uses profile skills for skill alignment, adds a verification bonus, and adds an exact-location bonus. It is not a validated employability prediction.
- Candidate job search, recommendations, and applications.
- Employer job drafts, publishing, accommodation descriptions, and candidate review.
- Employer business/representative verification submissions, private evidence, feedback/resubmission, and admin manual review at `/admin/employers`.
- Admin overview at `/admin` with database-backed verification counts; the existing `/admin/evaluation` route remains available.
- Blind initial candidate previews using pseudonymous references instead of names or disability details.
- Employer-only application status changes, checked against ownership of the related job.
- Admin-only evaluation view for functional suitability, performance efficiency, and interaction capability.
- A minimal accessibility control panel for visual support (contrast, text, motion, visual alerts), hearing support (caption reminders), and speech/communication support (text-first communication).
- Optional browser voice commands for navigation and guided voice fill for name, email, and account type. Passwords remain text-only.
- Optional space-key navigation mode: one Space moves to the next control and a second Space selects it; text entry keeps normal keyboard behavior.
- English and Tagalog labels for the landing page, account screens, navigation, and accessibility choices.
- Shared Postgres-backed request limits for authentication, profile/photo changes, applications, assessments, job posting, and read endpoints.
- Skeleton loaders, visible focus states, responsive layouts, and accessible error/status messaging.

## Matching algorithm workflow

```mermaid
flowchart TD
    A([Candidate skill IDs, levels, source + location<br/>Job skill IDs, weights, levels + location]) --> B{Does the job have required skills?}

    B -- No --> C[Return score 0<br/>Empty matched, missing, and verified lists<br/>Explain that required skills are needed]
    B -- Yes --> D[Build candidate skill lookup<br/>totalWeight = sum max(importance ?? 1, 1)<br/>Initialize matchedWeight and result lists]

    D --> E[Select next required skill]
    E --> F{Does candidate have the same skill_id?}

    F -- No --> G[Add skill to missing<br/>Contribution is 0]
    F -- Yes --> H[Set weight = max(importance ?? 1, 1)<br/>Set ratio = min(proficiency / max(required_level ?? 1, 1), 1)<br/>Add weight × ratio to matchedWeight<br/>Add skill to matched]

    H --> I{assessment_verified<br/>and proficiency ≥ 3?}
    I -- Yes --> J[Add skill to verified]
    I -- No --> K[Do not add a verification entry]

    G --> L{More required skills?}
    J --> L
    K --> L
    L -- Yes --> E
    L -- No --> M[Calculate score components<br/>Skill: 75 × matchedWeight / totalWeight<br/>Verification: 15 × verifiedCount / requiredCount<br/>Location: +10 if both locations are present and equal, ignoring case]

    M --> N[fit_score = round(min(sum of components, 100))]
    C --> O[Return score, matched / missing / verified,<br/>hasVerifiedEvidence, and explanation]
    N --> O
    O --> P[Repeat for each job and sort by fit_score descending]
    P -. Candidate recommendation/dashboard routes .-> Q[Keep jobs with hasVerifiedEvidence and fit_score ≥ 40]

    classDef start fill:#0f172a,stroke:#0f172a,color:#ffffff,stroke-width:2px;
    classDef process fill:#ccfbf1,stroke:#0f766e,color:#0f172a,stroke-width:1.5px;
    classDef decision fill:#ede9fe,stroke:#7c3aed,color:#0f172a,stroke-width:1.5px;
    classDef output fill:#fff5d7,stroke:#ca8a04,color:#0f172a,stroke-width:1.5px;
    class A start;
    class B,F,I,L decision;
    class D,E,G,H,J,K,M,N process;
    class C,O,P,Q output;
```

[Download the SVG version](docs/matching-algorithm-workflow.svg) for use in reports or thesis documents.

For each job with required skills, the skill-alignment component contributes up to 75 points using importance-weighted proficiency; assessment-verified skills at proficiency level 3 or higher contribute up to 15 points; and an exact, case-insensitive location match contributes 10 points. The total is rounded and capped at 100. Jobs without required skills receive a score of 0. `rankJobs` evaluates each job and sorts the results from highest to lowest score.

The candidate recommendation and dashboard endpoints apply a further filter after ranking: a job must have at least one verified skill and a fit score of 40 or higher. Disability category and RAND-36 health scores are not matching inputs; this transparent, rule-based score is not a validated employability prediction.

## Stack

- Next.js 16 App Router and React 19
- TypeScript
- Supabase Auth and Postgres with Row Level Security
- Supabase SSR cookie sessions
- CSS without a component framework, so the accessibility behavior stays inspectable

## System Requirements

### Hardware/Software Requirements for Development

| Hardware | Software |
| --- | --- |
| Processor: Intel Core i5-10300H CPU @ 2.50GHz (4 cores, 8 threads) or higher | Visual Studio Code |
| Graphics Card: NVIDIA GeForce GTX 1660 Ti (6GB) or higher | JavaScript / HTML / CSS |
| Memory: 8GB DDR4 (2933 MT/s) or higher | Python |
| Storage: 512GB SSD or higher | React.js |
|  | Figma |
|  | MySQL |
|  | Screen Reader (NVDA/JAWS) for testing |

Python, Figma, and MySQL are included here to preserve the thesis development-environment format. The deployed implementation in this repository uses TypeScript/React and Supabase Postgres; it does not require Python or MySQL at runtime.

### Hardware/Software Requirements for Implementation

| Hardware | Software |
| --- | --- |
| Laptop or Desktop | Web Browser (Google Chrome or Microsoft Edge) |
| Stable Internet Connection | WCAG 2.1 AA Compliance (Keyboard Navigation, High Contrast, etc.) |

The platform is browser-based and is designed for keyboard navigation, high contrast, screen-reader-friendly structures, and responsive use. Formal WCAG 2.1 AA/2.2 AA conformance still requires manual testing with assistive technologies and PWD participants.

## Local setup

1. Create a Supabase project and enable Email provider authentication.
2. In Supabase **Authentication > Providers > Email**, keep **Confirm email** enabled for a public deployment. New accounts confirm their address through `/auth/callback` before signing in. Disabling confirmation is acceptable only for a private pilot because it allows email impersonation.
3. Back up the Supabase project and verify restore before schema changes. This repository has no `supabase/config.toml`; use the approved SQL Editor/migration runner after checking the target project's migration history. Test the full migration chain on a disposable project, then run migrations `001_initial.sql` through `018_employer_verification.sql` in order. Migration 010 adds private, consent-linked RAND-36 responses and eight separate scale scores. Migration 012 adds optional gender to private profiles; it is not used in matching or shown to employers. Migrations 013 and 014 add and categorize the common-skills catalog into Business, Creative, Digital work, People, Technology, and Thinking. Migration 015 makes job and application writes server-managed; 016 serializes RAND-36 consent changes and adds one-time occupational assessment sessions; 017 installs the shared API rate-limit store; 018 installs employer verification, private evidence storage, and approval gates. Apply the migrations before deploying code that depends on them.
   Migration 018 intentionally closes existing published jobs so employers enter review as `not_submitted`; review and republish them only after approval. It retains job, application, offer, and message rows. Before production, count published jobs and coordinate the cutover with employers; review this expected status change after testing it on a restored disposable copy.
4. Copy `.env.example` to `.env.local` and fill in:

   ```text
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-limited-publishable-key
   SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
   ASSESSMENT_SESSION_SECRET=use-a-long-random-server-only-value
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

5. Add `http://localhost:3000/auth/callback` and the production `https://<your-domain>/auth/callback` to Supabase Auth redirect URLs. Set `NEXT_PUBLIC_SITE_URL` to the matching origin (HTTPS in production); it is used for confirmation and password-recovery email links.
6. Run:

   ```text
   npm ci
   npm run dev
   ```

The first registered account becomes a candidate or employer according to the selected role. New users cannot request the `admin` role: the auth trigger maps metadata only to candidate/employer, and the profile-role trigger blocks owner-side role changes. To provision the first administrator safely, create and confirm that person’s account normally, verify their identity, then use the Supabase SQL Editor as the project owner to update exactly that existing profile by its reviewed UUID:

```sql
update public.profiles
set role = 'admin'
where id = '<reviewed-auth-user-uuid>'
  and email = '<confirmed-admin-email>';
```

Verify the affected row before continuing. Never put admin credentials or the service-role key in source control or browser code.

## Employer verification

Employer verification is a manual review workflow, not an automated document-authenticity check. The verification form asks for the registered/official name, optional trading name, business type, relevant issuing authority/record number, address, company contact details, optional website, and representative name/role. It does not require government IDs and does not reject public email providers.

Evidence requirements depend on business type. Sole proprietorships, partnerships, corporations, cooperatives, and nonprofits provide a relevant business-registration record and authority/registration number. Government offices and other entities can provide equivalent official-source evidence; their record number is optional. A local permit is required only when the employer says it applies. Separate representative-authorization evidence is required only when the representative is not the owner or a recorded officer. The reviewer must enter the source and time checked, the business-information result, and how representative authorization was checked before approval.

The allowed states and transitions are:

| Current state | Employer action | Admin action / resulting state |
| --- | --- | --- |
| `not_submitted` | Submit evidence → `pending` | No decision before submission |
| `pending` | Wait for review | `approved`, `needs_information`, `rejected`, or `suspended` |
| `needs_information` | Correct and resubmit → `pending` | Repeat request, approve, reject, or suspend |
| `approved` | Contact-only updates retain approval; legal/trading identity, business type/registration/address, representative changes, or new evidence trigger re-review | Request information, reject, or suspend |
| `rejected` | Correct and resubmit → `pending` | Admin reviews the new submission |
| `suspended` | Contact PWDconnect; employers cannot resubmit while suspended | Admin may request information, approve after a fresh check, or reject |

When an employer moves out of `approved`, published jobs are closed and must be republished after approval. Migration 018 also closes existing published jobs at cutover because existing employers start at `not_submitted`. Jobs, applications, offers, and messages are preserved; applicant access to their own records remains. No closed job is automatically republished.

Verification evidence is stored in the private `employer-verification` bucket. Employers can only upload evidence through a server route; direct client storage access is denied. Downloads use five-minute signed URLs for the owning employer or an authorized admin. Draft evidence can be supplemented by uploading additional files; submitted evidence is retained with its submission history. Files are kept while the employer account exists, with no automatic expiry. For an approved erasure request or before deleting an account, an admin uses the two-phase evidence-erasure endpoint: it blocks uploads/review and closes any published jobs first, then deletes storage objects and metadata and records the erasure. Failed storage cleanup stays blocked until retried. The database restricts profile deletion until document metadata is removed. Verification rows and their audit history cascade with deletion of the employer profile. There is no automated account-deletion or retention scheduler.

Uploads are limited to PDF, JPG, PNG, and WebP files up to 4 MB to fit the server upload path. The API checks file signatures and MIME agreement and generates storage names; this is not malware scanning or a full document parser. Do not claim a document was officially verified merely because it was uploaded. The badge “Business and representative reviewed” appears only while the employer is approved and includes the review date plus a limitation statement.

Unverified employers can complete profiles and save draft jobs. Backend checks, database triggers, and RLS restrict publication and private applicant recruitment data to approved employers. When verification becomes non-approved, employer access to applicant conversations, offers, and candidate previews is blocked; candidates keep access to their own application records and messages.

Supabase enforces authentication request rate limits; those limits are intentionally not removed because they protect blind and sighted users from credential abuse, spam, and account lockout attacks. PWD Connect also applies server-side limits to sensitive API actions and returns plain-language, screen-reader-announced `429` errors. In production these limits use the Postgres function and table from migration 017; if that shared store is missing or unavailable, protected API requests fail closed with `503` rather than silently falling back to per-instance counters.

## Security model

- Browser code uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` is imported only by files marked `server-only` and is used for limited server tasks such as private answer-key reads, explicit employer-name lookups, and blind candidate-score recalculation.
- Verification review mutations use authenticated Postgres functions that check `auth.uid()` against the secure `profiles.role = 'admin'` source. Admin pages and APIs repeat that check; middleware is not the authorization boundary.
- Employer verification state, submission snapshots, documents, and review events have RLS enabled. Employers can read only their own submitted information/doc metadata; internal review events are admin-only. The private evidence bucket has no direct authenticated/anonymous object policy; signed links are issued by authorized server routes.
- `employer_verification_events` is append-only for normal application roles. Review decisions and their audit events are written in one database function/transaction, with a revision check to reject stale concurrent reviewer decisions.
- RAND-36 item and scale scoring follows the linked RAND 36-Item Health Survey Version 1.0 scoring instructions; the health-change item is stored separately. RAND-36 results are not part of `lib/matching.ts` and are not shown to employers.
- RAND instrument attribution: developed at RAND as part of the Medical Outcomes Study. Web layout follows RAND's English Version 1.0 form and scoring rules; translations are not supplied or represented as validated. See [RAND scoring](https://www.rand.org/health/surveys/mos/36-item-short-form/scoring.html) and [RAND use terms](https://www.rand.org/health/surveys/mos/36-item-short-form/terms.html).
- Every protected route calls `supabase.auth.getUser()` and derives the actor ID from the verified session. No request accepts a user ID to decide ownership.
- Candidate profile, skills, assessment attempts, and applications are filtered by the authenticated ID.
- Employer operations verify the employer role and the employer ID on the related job before returning or mutating data.
- Only approved employers can publish jobs or access candidate applications, conversations, offers, or candidate previews. This is enforced by API checks, RLS, and database triggers; closing jobs on downgrade does not delete related applications or messages.
- Employer self-registration metadata can select only candidate/employer roles. The admin role is provisioned separately using the Supabase project-owner workflow in Local setup.
- Browser clients cannot directly insert, update, or delete jobs, job skills, or applications after migration 015; API routes verify the session and ownership before using the server-only client.
- Occupational assessment session IDs are signed and unique, so a completed session cannot be replayed; RAND-36 submission checks the latest consent event in the same serialized database lock used for consent changes.
- Initial employer candidate responses intentionally omit candidate names, email, disability type, and contact data.
- Runtime data access uses Supabase’s query builder, which sends values as query parameters. Search terms are escaped for wildcard behavior; no user input is interpolated into SQL.
- Postgres RLS remains enabled even when a route uses the server-only service client. Service-client calls happen only after an explicit session and role/ownership check.
- Profile photos are accepted only as JPG, PNG, or WebP files up to 5 MB. The upload route applies a bounded streamed request read, validates the session and file signature, keeps the bucket private, checks the stored object path belongs to the authenticated user before signing or deleting it, replaces the previous owned object, and returns short-lived signed URLs with user-provided alt text.

## Deployment

### Vercel

Import the repository into Vercel and set the Supabase URL, anon key, service-role key, `ASSESSMENT_SESSION_SECRET`, and `NEXT_PUBLIC_SITE_URL` (the production HTTPS origin) for the intended environments. Apply and verify migrations through 018 on the target database before deployment. Include the production `/auth/callback` URL in Supabase’s redirect allowlist. Next automatically uses the `build` script.

### Docker

```text
docker build -t pwd-connect .
docker run --env-file .env.local -p 3000:3000 pwd-connect
```

The image uses Next standalone output. Configure HTTPS, secure Supabase redirect URLs, database backups, and an error-monitoring service before a public launch.

## Accessibility verification

The interface is built toward WCAG 2.2 AA and the thesis’s ISO/IEC 25010 Interaction Capability goals. Formal conformance must still be verified against the deployed environment with:

- Keyboard-only completion of registration, profile, conditional employer-verification fields and evidence upload, admin queue search/filter/pagination, review decisions, assessment, job search, and applications.
- NVDA or JAWS with Chromium, plus VoiceOver/Safari where available; confirm announcements for loading/errors/status changes and that internal reviewer notes never appear in the employer view.
- Browser voice input and navigation with microphone permission denied and granted, plus a keyboard-only fallback.
- 200% zoom and reflow at mobile widths.
- High contrast and reduced-motion settings.
- Automated axe or Lighthouse checks followed by manual review.
- Testing with PWD participants, including visual, hearing, and speech disabilities.

## Employer verification staging checklist

Run this checklist against a disposable Supabase project after applying migrations through 018. Do not use production records as test fixtures.

- Candidate, unverified employer, and non-admin direct requests to admin list/detail/decision endpoints return 401/403 and cannot call the review RPC successfully.
- An employer cannot read another employer’s verification row or evidence, and an applicant cannot read either employer’s private documents.
- An unapproved employer may save a draft, but cannot publish through the UI, API, direct REST, or an attempted status update; a direct application insert for a closed/unapproved employer opening is rejected by the database trigger.
- An approved employer can publish, and can access candidate previews, applications, messages, and offers. Candidate users still read their own records after an employer is sent back for information or suspended.
- Try invalid transitions, missing reviewer reason/feedback, and approval without source/check-time/result/representative-method data; each must fail. Verify matched business results are required for approval.
- Submit two decisions from separate admin sessions using the same review revision; the second stale decision must return a conflict and leave the first decision and audit row intact.
- Change the employer’s organization name or material identity/representative fields after approval; verify approval is revoked, published jobs close without deleting application/message/offer rows, and republishing is manual after re-approval.
- Confirm the employer API never includes internal notes; confirm signed evidence links expire and forged MIME types/oversized files are rejected.
- Enter valid form data, deliberately omit required conditional evidence, and submit; confirm the error is announced and all entered fields remain available for correction.
- Test the evidence-erasure endpoint with an authorized admin; confirm objects and metadata are removed and the erasure event is retained while the account remains active.

The product deliberately does not claim that automated checks alone prove accessibility.
