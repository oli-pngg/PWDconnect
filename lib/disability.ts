export const DISABILITY_OPTIONS = [
  {
    value: 'visual',
    label: 'Visual disability',
    description: ' '
  },
  {
    value: 'hearing',
    label: 'Hearing disability',
    description: ' '
  },
  {
    value: 'speech',
    label: 'Speech disability',
    description: ' '
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
] as const;

export const DISABILITY_VALUES = DISABILITY_OPTIONS.map((option) => option.value);

export type DisabilityType = (typeof DISABILITY_OPTIONS)[number]['value'];
