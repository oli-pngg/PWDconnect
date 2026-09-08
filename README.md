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
- Keyboard and screen-reader-friendly skill assessment with no mandatory countdown.
- Server-side assessment scoring; answer keys are never returned to the browser.
- Transparent fit scoring based on required skills, verification, and location preference.
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
2. In Supabase **Authentication > Providers > Email**, turn off **Confirm email** for the password-only pilot flow. New accounts will then receive a session immediately without an email verification step. Disabling confirmation means anyone with access to an email address can register it, so keep this setting limited to the intended pilot.
3. In the Supabase SQL editor, run `supabase/migrations/001_initial.sql`, then `supabase/migrations/002_add_disability_types.sql`, then `supabase/migrations/003_keep_sensitive_profiles_private.sql`, then `supabase/migrations/004_accessible_profiles_and_photos.sql`, and finally `supabase/migrations/005_messaging_and_job_offers.sql`. The fourth migration creates the `profile-photos` Storage bucket and its ownership policies; the fifth adds realtime application messaging and job offers.
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

The application does not send a verification-email request when Confirm email is off. Supabase still enforces authentication request rate limits; those limits are intentionally not removed because they protect blind and sighted users from credential abuse, spam, and account lockout attacks. PWD Connect also applies server-side limits to sensitive API actions and returns plain-language, screen-reader-announced `429` errors. The built-in limiter is process-local; deployments with multiple instances should place a shared store such as Redis or an edge rate-limit service in front of the app.

## Security model

- Browser code uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` is imported only by files marked `server-only` and is used for limited server tasks such as private answer-key reads and explicit employer-name lookups.
- Every protected route calls `supabase.auth.getUser()` and derives the actor ID from the verified session. No request accepts a user ID to decide ownership.
- Candidate profile, skills, assessment attempts, and applications are filtered by the authenticated ID.
- Employer operations verify the employer role and the employer ID on the related job before returning or mutating data.
- Initial employer candidate responses intentionally omit candidate names, email, disability type, and contact data.
- Runtime data access uses Supabase’s query builder, which sends values as query parameters. Search terms are escaped for wildcard behavior; no user input is interpolated into SQL.
- Postgres RLS remains enabled even when a route uses the server-only service client. Service-client calls happen only after an explicit session and role/ownership check.
- Profile photos are accepted only as JPG, PNG, or WebP files up to 5 MB. The upload route validates the session, replaces the previous owned object, and stores the user-provided short alt text with the profile.

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
