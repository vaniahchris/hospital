import type { QuestionOption } from './feedback';

/** Fallback prompts/options if the DB inpatient rows are missing. Keys match inpatient_answers. */
export const INPATIENT_QUESTION_DEFS: {
  slug: string;
  prompt: string;
  question_type: 'rating' | 'choice';
  options: QuestionOption[];
}[] = [
  {
    slug: 'care',
    prompt: 'How would you rate the overall quality of care you received during your stay?',
    question_type: 'rating',
    options: [
      { label: 'Excellent' },
      { label: 'Very Good' },
      { label: 'Good' },
      { label: 'Fair' },
      { label: 'Poor' },
    ],
  },
  {
    slug: 'staff',
    prompt: 'How would you rate the friendliness and professionalism of our staff?',
    question_type: 'rating',
    options: [
      { label: 'Excellent' },
      { label: 'Very Good' },
      { label: 'Good' },
      { label: 'Fair' },
      { label: 'Poor' },
    ],
  },
  {
    slug: 'room',
    prompt: 'How would you rate the cleanliness and comfort of your room?',
    question_type: 'rating',
    options: [
      { label: 'Excellent' },
      { label: 'Very Good' },
      { label: 'Good' },
      { label: 'Fair' },
      { label: 'Poor' },
    ],
  },
  {
    slug: 'recommend',
    prompt: 'How likely are you to recommend Value Family Hospital to your friends or family?',
    question_type: 'choice',
    options: [
      { label: 'Very Likely' },
      { label: 'Likely' },
      { label: 'Maybe' },
      { label: 'Unlikely' },
      { label: 'Very Unlikely' },
    ],
  },
];

export const inpatientQuestionColumns = INPATIENT_QUESTION_DEFS.map((q) => ({
  id: q.slug,
  prompt: q.prompt,
}));
