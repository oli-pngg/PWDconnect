export type Rand36Option = { code: number; label: string };
export type Rand36Item = { number: number; prompt: string; options: Rand36Option[] };
export type Rand36ScaleScore = { scale_code: string; label: string; score: number | null; answered_items: number; item_count: number };

const optionSets = {
  health: ['Excellent', 'Very good', 'Good', 'Fair', 'Poor'],
  healthChange: ['Much better now than one year ago', 'Somewhat better now than one year ago', 'About the same', 'Somewhat worse now than one year ago', 'Much worse now than one year ago'],
  activity: ['Yes, limited a lot', 'Yes, limited a little', 'No, not limited at all'],
  yesNo: ['Yes', 'No'],
  extent: ['Not at all', 'Slightly', 'Moderately', 'Quite a bit', 'Extremely'],
  pain: ['None', 'Very mild', 'Mild', 'Moderate', 'Severe', 'Very severe'],
  painInterference: ['Not at all', 'A little bit', 'Moderately', 'Quite a bit', 'Extremely'],
  frequency: ['All of the time', 'Most of the time', 'A good bit of the time', 'Some of the time', 'A little of the time', 'None of the time'],
  frequencyShort: ['All of the time', 'Most of the time', 'Some of the time', 'A little of the time', 'None of the time'],
  trueFalse: ['Definitely true', 'Mostly true', "Don't know", 'Mostly false', 'Definitely false']
};

const choices = (labels: string[]): Rand36Option[] => labels.map((label, index) => ({ code: index + 1, label }));

export const RAND36_SECTIONS: Array<{ title: string; instructions?: string; items: Rand36Item[] }> = [
  { title: 'General health perceptions', items: [
    { number: 1, prompt: 'In general, would you say your health is:', options: choices(optionSets.health) }
  ] },
  { title: 'Health change (separate item)', instructions: 'This item is reported separately and is not part of any of the eight scale scores.', items: [
    { number: 2, prompt: 'Compared to one year ago, how would you rate your health in general now?', options: choices(optionSets.healthChange) }
  ] },
  { title: 'Physical functioning', instructions: 'The following items are about activities you might do during a typical day. Does your health now limit you in these activities? If so, how much?', items: [
    { number: 3, prompt: 'Vigorous activities, such as running, lifting heavy objects, participating in strenuous sports', options: choices(optionSets.activity) },
    { number: 4, prompt: 'Moderate activities, such as moving a table, pushing a vacuum cleaner, bowling, or playing golf', options: choices(optionSets.activity) },
    { number: 5, prompt: 'Lifting or carrying groceries', options: choices(optionSets.activity) },
    { number: 6, prompt: 'Climbing several flights of stairs', options: choices(optionSets.activity) },
    { number: 7, prompt: 'Climbing one flight of stairs', options: choices(optionSets.activity) },
    { number: 8, prompt: 'Bending, kneeling, or stooping', options: choices(optionSets.activity) },
    { number: 9, prompt: 'Walking more than a mile', options: choices(optionSets.activity) },
    { number: 10, prompt: 'Walking several blocks', options: choices(optionSets.activity) },
    { number: 11, prompt: 'Walking one block', options: choices(optionSets.activity) },
    { number: 12, prompt: 'Bathing or dressing yourself', options: choices(optionSets.activity) }
  ] },
  { title: 'Role limitations due to physical health', instructions: 'During the past 4 weeks, have you had any of the following problems with your work or other regular daily activities as a result of your physical health?', items: [
    { number: 13, prompt: 'Cut down the amount of time you spent on work or other activities', options: choices(optionSets.yesNo) },
    { number: 14, prompt: 'Accomplished less than you would like', options: choices(optionSets.yesNo) },
    { number: 15, prompt: 'Were limited in the kind of work or other activities', options: choices(optionSets.yesNo) },
    { number: 16, prompt: 'Had difficulty performing the work or other activities (for example, it took extra effort)', options: choices(optionSets.yesNo) }
  ] },
  { title: 'Role limitations due to emotional problems', instructions: 'During the past 4 weeks, have you had any of the following problems with your work or other regular daily activities as a result of emotional problems (such as feeling depressed or anxious)?', items: [
    { number: 17, prompt: 'Cut down the amount of time you spent on work or other activities', options: choices(optionSets.yesNo) },
    { number: 18, prompt: 'Accomplished less than you would like', options: choices(optionSets.yesNo) },
    { number: 19, prompt: "Didn't do work or other activities as carefully as usual", options: choices(optionSets.yesNo) }
  ] },
  { title: 'Social functioning', items: [
    { number: 20, prompt: 'During the past 4 weeks, to what extent has your physical health or emotional problems interfered with your normal social activities with family, friends, neighbors, or groups?', options: choices(optionSets.extent) }
  ] },
  { title: 'Bodily pain', items: [
    { number: 21, prompt: 'How much bodily pain have you had during the past 4 weeks?', options: choices(optionSets.pain) },
    { number: 22, prompt: 'During the past 4 weeks, how much did pain interfere with your normal work (including both work outside the home and housework)?', options: choices(optionSets.painInterference) }
  ] },
  { title: 'Energy, fatigue, and emotional well-being items', instructions: 'These questions are about how you feel and how things have been with you during the past 4 weeks. For each question, please give the one answer that comes closest to the way you have been feeling. How much of the time during the past 4 weeks...', items: [
    { number: 23, prompt: 'Did you feel full of pep?', options: choices(optionSets.frequency) },
    { number: 24, prompt: 'Have you been a very nervous person?', options: choices(optionSets.frequency) },
    { number: 25, prompt: 'Have you felt so down in the dumps that nothing could cheer you up?', options: choices(optionSets.frequency) },
    { number: 26, prompt: 'Have you felt calm and peaceful?', options: choices(optionSets.frequency) },
    { number: 27, prompt: 'Did you have a lot of energy?', options: choices(optionSets.frequency) },
    { number: 28, prompt: 'Have you felt downhearted and blue?', options: choices(optionSets.frequency) },
    { number: 29, prompt: 'Did you feel worn out?', options: choices(optionSets.frequency) },
    { number: 30, prompt: 'Have you been a happy person?', options: choices(optionSets.frequency) },
    { number: 31, prompt: 'Did you feel tired?', options: choices(optionSets.frequency) }
  ] },
  { title: 'Social functioning', items: [
    { number: 32, prompt: 'During the past 4 weeks, how much of the time has your physical health or emotional problems interfered with your social activities (like visiting with friends, relatives, etc.)?', options: choices(optionSets.frequencyShort) }
  ] },
  { title: 'General health perceptions', instructions: 'How true or false is each of the following statements for you?', items: [
    { number: 33, prompt: 'I seem to get sick a little easier than other people', options: choices(optionSets.trueFalse) },
    { number: 34, prompt: 'I am as healthy as anybody I know', options: choices(optionSets.trueFalse) },
    { number: 35, prompt: 'I expect my health to get worse', options: choices(optionSets.trueFalse) },
    { number: 36, prompt: 'My health is excellent', options: choices(optionSets.trueFalse) }
  ] }
];

export const RAND36_SCALES = [
  { code: 'physical_functioning', label: 'Physical functioning', items: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { code: 'role_physical', label: 'Role limitations due to physical health', items: [13, 14, 15, 16] },
  { code: 'role_emotional', label: 'Role limitations due to emotional problems', items: [17, 18, 19] },
  { code: 'energy_fatigue', label: 'Energy and fatigue', items: [23, 27, 29, 31] },
  { code: 'emotional_wellbeing', label: 'Emotional well-being', items: [24, 25, 26, 28, 30] },
  { code: 'social_functioning', label: 'Social functioning', items: [20, 32] },
  { code: 'bodily_pain', label: 'Bodily pain', items: [21, 22] },
  { code: 'general_health', label: 'General health perceptions', items: [1, 33, 34, 35, 36] }
] as const;

const scoringGroups: Array<{ items: number[]; values: number[] }> = [
  { items: [1, 2, 20, 22, 34, 36], values: [100, 75, 50, 25, 0] },
  { items: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], values: [0, 50, 100] },
  { items: [13, 14, 15, 16, 17, 18, 19], values: [0, 100] },
  { items: [21, 23, 26, 27, 30], values: [100, 80, 60, 40, 20, 0] },
  { items: [24, 25, 28, 29, 31], values: [0, 20, 40, 60, 80, 100] },
  { items: [32, 33, 35], values: [0, 25, 50, 75, 100] }
];

export function scoreRand36(input: Record<string, unknown>) {
  const itemByNumber = new Map(RAND36_SECTIONS.flatMap((section) => section.items).map((item) => [item.number, item]));
  const recoded = new Map<number, number>();
  const responses: Array<{ item_number: number; response_code: number; recoded_score: number }> = [];

  for (const [key, raw] of Object.entries(input)) {
    const itemNumber = Number(key);
    const item = itemByNumber.get(itemNumber);
    if (!item || String(itemNumber) !== key || typeof raw !== 'number' || !Number.isInteger(raw) || !item.options.some((option) => option.code === raw)) throw new Error('Invalid RAND-36 response.');
    const group = scoringGroups.find((candidate) => candidate.items.includes(itemNumber));
    if (!group) throw new Error('RAND-36 scoring key is incomplete.');
    const recodedScore = group.values[raw - 1];
    recoded.set(itemNumber, recodedScore);
    responses.push({ item_number: itemNumber, response_code: raw, recoded_score: recodedScore });
  }

  const scales = RAND36_SCALES.map((scale) => {
    const values = scale.items.map((item) => recoded.get(item)).filter((value): value is number => value !== undefined);
    return {
      scale_code: scale.code,
      label: scale.label,
      score: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
      answered_items: values.length,
      item_count: scale.items.length
    };
  });

  return {
    responses,
    scales,
    health_change_response: recoded.has(2) ? input['2'] as number : null,
    health_change_score: recoded.get(2) ?? null
  };
}
