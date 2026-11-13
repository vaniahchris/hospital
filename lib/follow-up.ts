import { hasNegativeReview } from '@/lib/feedback';

export const SEEN_URGENT_KEY = 'admin-seen-urgent-ids';

export type FollowUpSubmission = {
  id: string;
  source: 'outpatient' | 'inpatient';
  inpatient_answers: Record<string, string> | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  answers?: { value: string; question_id: string }[] | null;
};

export function readSeenUrgentIds() {
  if (typeof window === 'undefined') return [] as string[];
  try {
    const raw = window.localStorage.getItem(SEEN_URGENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

export function writeSeenUrgentIds(ids: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SEEN_URGENT_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event('follow-up-seen'));
}

export function answersByQuestionId(
  answers: FollowUpSubmission['answers']
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const answer of answers ?? []) {
    map[answer.question_id] = answer.value;
  }
  return map;
}

/** Negative feedback that includes contact details — needs staff outreach. */
export function needsFollowUp(row: FollowUpSubmission) {
  const hasContact = !!(row.contact_phone?.trim() || row.contact_email?.trim());
  if (!hasContact) return false;

  if (row.source === 'inpatient') {
    const answers = row.inpatient_answers ?? {};
    return (
      hasNegativeReview(answers) ||
      ['Unlikely', 'Very Unlikely'].includes(answers.recommend)
    );
  }

  return hasNegativeReview(answersByQuestionId(row.answers));
}
