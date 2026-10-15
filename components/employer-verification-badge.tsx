export function EmployerVerificationBadge({ approvedAt }: { approvedAt: string | null | undefined }) {
  if (!approvedAt) return null;
  const date = new Date(approvedAt);
  if (Number.isNaN(date.valueOf())) return null;
  const reviewDate = new Intl.DateTimeFormat('en-PH', { dateStyle: 'long' }).format(date);
  return (
    <div className="employer-verification-indicator">
      <span className="employer-verification-badge">Business and representative reviewed</span>
      <details className="employer-verification-explanation">
        <summary>What was reviewed?</summary>
        <p>PWDconnect reviewed this employer’s business information and representative authorization on {reviewDate}. Verification is not a guarantee of every job offer.</p>
      </details>
    </div>
  );
}
