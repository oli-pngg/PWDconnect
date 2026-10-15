export const GENDER_OPTIONS = [
  { value: 'woman', label: 'Female', tagalog: 'Babae' },
  { value: 'man', label: 'Male', tagalog: 'Lalaki' },
  { value: 'non_binary', label: 'Non-binary', tagalog: 'Non-binary' },
  { value: 'another_identity', label: 'Another gender identity', tagalog: 'Iba pang gender identity' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say', tagalog: 'Mas gustong hindi sabihin' }
] as const;

export type GenderOption = (typeof GENDER_OPTIONS)[number]['value'];
