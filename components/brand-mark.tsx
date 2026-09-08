import { Radio } from 'lucide-react';
import Link from 'next/link';

export function BrandMark({ href = '/', showName = true }: { href?: string; showName?: boolean }) {
  return (
    <Link className="brand" href={href} aria-label="PWD Connect home">
      <span className="brand-mark" aria-hidden="true"><Radio size={20} strokeWidth={2.7} /></span>
      {showName ? <span className="brand-name">PWD Connect</span> : null}
    </Link>
  );
}
