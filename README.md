# PWD Connect Job Pairing Platform

PWD Connect is a deployable Next.js and Supabase implementation of the supplied thesis concept: an accessible, skills-first job pairing platform for persons with visual, hearing, and speech disabilities in Legazpi City and Albay.

## Included workflows

- Email/password registration and sign in for candidates and employers.
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
- Blind initial candidate previews using pseudonymous references instead of names or disability details.
- Employer-only application status changes, checked against ownership of the related job.
- Admin-only evaluation view for functional suitability, performance efficiency, and interaction capability.
- A minimal accessibility control panel for visual support (contrast, text, motion, visual alerts), hearing support (caption reminders), and speech/communication support (text-first communication).
- Optional browser voice commands for navigation and guided voice fill for name, email, and account type. Passwords remain text-only.
- Optional space-key navigation mode: one Space moves to the next control and a second Space selects it; text entry keeps normal keyboard behavior.
- English and Tagalog labels for the landing page, account screens, navigation, and accessibility choices.
- Server-side request limits for authentication, profile/photo changes, applications, assessments, job posting, and read endpoints.
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
3. Back up the Supabase project and verify restore before schema changes. Test the migration chain on a disposable project, then run migrations `001_initial.sql` through `014_additional_common_skills.sql` in order. Migration 010 adds private, consent-linked RAND-36 responses and eight separate scale scores. Migration 012 adds optional gender to private profiles; it is not used in matching or shown to employers. Migrations 013 and 014 add and categorize the common-skills catalog into Business, Creative, Digital work, People, Technology, and Thinking. Do not apply the locally untracked migrations to a populated project until its migration history has been checked.
4. Copy `.env.example` to `.env.local` and fill in:

   ```text
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-limited-publishable-key
   SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

5. Add `http://localhost:3000/auth/callback` to Supabase Auth redirect URLs.
6. Run:

   ```text
   npm install
   npm run dev
   ```

The first registered account becomes a candidate or employer according to the selected role. To create a research administrator, update that user’s `profiles.role` to `admin` from a protected Supabase administration workflow. Do not expose or use the service-role key in a browser.

Supabase enforces authentication request rate limits; those limits are intentionally not removed because they protect blind and sighted users from credential abuse, spam, and account lockout attacks. PWD Connect also applies server-side limits to sensitive API actions and returns plain-language, screen-reader-announced `429` errors. The built-in limiter is process-local; deployments with multiple instances should place a shared store such as Redis or an edge rate-limit service in front of the app.

## Security model

- Browser code uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` is imported only by files marked `server-only` and is used for limited server tasks such as private answer-key reads, explicit employer-name lookups, and blind candidate-score recalculation.
- RAND-36 item and scale scoring follows the linked RAND 36-Item Health Survey Version 1.0 scoring instructions; the health-change item is stored separately. RAND-36 results are not part of `lib/matching.ts` and are not shown to employers.
- RAND instrument attribution: developed at RAND as part of the Medical Outcomes Study. Web layout follows RAND's English Version 1.0 form and scoring rules; translations are not supplied or represented as validated. See [RAND scoring](https://www.rand.org/health/surveys/mos/36-item-short-form/scoring.html) and [RAND use terms](https://www.rand.org/health/surveys/mos/36-item-short-form/terms.html).
- Every protected route calls `supabase.auth.getUser()` and derives the actor ID from the verified session. No request accepts a user ID to decide ownership.
- Candidate profile, skills, assessment attempts, and applications are filtered by the authenticated ID.
- Employer operations verify the employer role and the employer ID on the related job before returning or mutating data.
- Initial employer candidate responses intentionally omit candidate names, email, disability type, and contact data.
- Runtime data access uses Supabase’s query builder, which sends values as query parameters. Search terms are escaped for wildcard behavior; no user input is interpolated into SQL.
- Postgres RLS remains enabled even when a route uses the server-only service client. Service-client calls happen only after an explicit session and role/ownership check.
- Profile photos are accepted only as JPG, PNG, or WebP files up to 5 MB. The upload route validates the session and file signature, keeps the bucket private, replaces the previous owned object, and returns short-lived signed URLs with user-provided alt text.

## Deployment

### Vercel

Import the repository into Vercel, set the three Supabase environment variables for Production/Preview as appropriate, and deploy. Next automatically uses the `build` script.

### Docker

```text
docker build -t pwd-connect .
docker run --env-file .env.local -p 3000:3000 pwd-connect
```

The image uses Next standalone output. Configure HTTPS, secure Supabase redirect URLs, database backups, and an error-monitoring service before a public launch.

## Accessibility verification

The interface is built toward WCAG 2.2 AA and the thesis’s ISO/IEC 25010 Interaction Capability goals. Formal conformance must still be verified against the deployed environment with:

- Keyboard-only completion of registration, profile, assessment, job search, application, and employer review.
- NVDA or JAWS with Chromium, plus VoiceOver/Safari where available.
- Browser voice input and navigation with microphone permission denied and granted, plus a keyboard-only fallback.
- 200% zoom and reflow at mobile widths.
- High contrast and reduced-motion settings.
- Automated axe or Lighthouse checks followed by manual review.
- Testing with PWD participants, including visual, hearing, and speech disabilities.

The product deliberately does not claim that automated checks alone prove accessibility.
