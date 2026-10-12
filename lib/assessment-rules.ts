export const MIN_OCCUPATIONAL_QUESTIONS = 5;
export const MAX_OCCUPATIONAL_QUESTIONS = 50;
export const QUESTIONS_PER_ATTEMPT = 6;

export function isValidOccupationalQuestionCount(count: number) {
  return Number.isInteger(count) && count >= MIN_OCCUPATIONAL_QUESTIONS && count <= MAX_OCCUPATIONAL_QUESTIONS;
}
