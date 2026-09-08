export const DISABILITY_OPTIONS = [
  {
    value: 'visual',
    label: 'Visual disability',
    description: 'Screen reader, magnification, contrast, or other visual support'
  },
  {
    value: 'hearing',
    label: 'Hearing disability',
    description: 'Captions, transcripts, visual alerts, or other hearing support'
  },
  {
    value: 'speech',
    label: 'Speech disability',
    description: 'Text-first communication or alternatives to speaking'
  },
  {
    value: 'multiple',
    label: 'Multiple disabilities',
    description: 'More than one disability or access need'
  },
  {
    value: 'other',
    label: 'Other access need',
    description: 'Another support need not listed here'
  },
  {
    value: 'prefer_not_to_say',
    label: 'Prefer not to say',
    description: 'Keep this information private'
  }
] as const;

export const DISABILITY_VALUES = DISABILITY_OPTIONS.map((option) => option.value);

export type DisabilityType = (typeof DISABILITY_OPTIONS)[number]['value'];
