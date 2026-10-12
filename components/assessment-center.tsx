'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AssessmentView } from '@/components/assessment-view';
import { Rand36Assessment } from '@/components/rand36-assessment';

export function AssessmentCenter() {
  const [occupational, setOccupational] = useState(false);
  if (occupational) return <><button className="button secondary small" type="button" onClick={() => setOccupational(false)}><ArrowLeft size={15} aria-hidden="true" /> RAND-36</button><AssessmentView /></>;
  return <Rand36Assessment onContinue={() => setOccupational(true)} />;
}
