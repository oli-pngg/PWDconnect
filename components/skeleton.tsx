export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}

export function DashboardSkeleton() {
  return (
    <div className="loading-grid" aria-label="Loading dashboard" role="status">
      <span className="sr-only">Loading dashboard</span>
      <div className="stat-grid">
        {Array.from({ length: 4 }).map((_, index) => <div className="skeleton-card" key={index}><Skeleton className="skeleton-title" /><Skeleton className="skeleton-line short" /></div>)}
      </div>
      <div className="content-grid">
        <div className="skeleton-card"><div className="skeleton-stack"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line short" /></div></div>
        <div className="skeleton-card"><div className="skeleton-stack"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line short" /></div></div>
      </div>
    </div>
  );
}

export function JobListSkeleton() {
  return (
    <div className="loading-grid" aria-label="Loading jobs" role="status">
      <span className="sr-only">Loading jobs</span>
      {Array.from({ length: 3 }).map((_, index) => (
        <div className="skeleton-card" key={index}>
          <div className="skeleton-stack"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line short" /></div>
        </div>
      ))}
    </div>
  );
}
