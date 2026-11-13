'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, Heart, MessageCircle, Phone } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { QuestionRow } from '@/lib/feedback';
import { INPATIENT_QUESTION_DEFS } from '@/lib/inpatient-questions';

type Answers = Record<string, string>;

const emojiByLabel: Record<string, string> = {
  Excellent: '😃',
  'Very Good': '🙂',
  Good: '😊',
  Fair: '😐',
  Poor: '☹️',
  'Very Likely': '👍',
  Likely: '👍',
  Maybe: '😐',
  Unlikely: '👎',
  'Very Unlikely': '👎',
};

const colorByLabel: Record<string, string> = {
  Excellent: 'plum',
  'Very Good': 'teal',
  Good: 'gold',
  Fair: 'teal',
  Poor: 'plum',
  'Very Likely': 'plum',
  Likely: 'teal',
  Maybe: 'gold',
  Unlikely: 'teal',
  'Very Unlikely': 'plum',
};

function Rating({
  title,
  id,
  options,
  value,
  onChange,
}: {
  title: string;
  id: string;
  options: { label: string }[];
  value?: string;
  onChange: (id: string, value: string) => void;
}) {
  return (
    <section className="rating-group" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      <div className="options" role="radiogroup" aria-labelledby={`${id}-title`}>
        {options.map((option) => (
          <button
            type="button"
            key={option.label}
            className={`rating-option ${value === option.label ? 'selected' : ''}`}
            role="radio"
            aria-checked={value === option.label}
            onClick={() => onChange(id, option.label)}
          >
            <span
              className={`emoji-badge ${colorByLabel[option.label] ?? 'teal'}`}
              aria-hidden="true"
            >
              {emojiByLabel[option.label] ?? '•'}
            </span>
            <span>{option.label}</span>
            {value === option.label ? (
              <Check size={18} className="selection-check" aria-hidden="true" />
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}

function fallbackQuestions(): QuestionRow[] {
  return INPATIENT_QUESTION_DEFS.map((def, index) => ({
    id: def.slug,
    prompt: def.prompt,
    question_type: def.question_type,
    options: def.options,
    sort_order: index + 1,
    is_active: true,
    is_required: true,
    form_source: 'inpatient',
    slug: def.slug,
  }));
}

export default function InpatientFeedback() {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [comments, setComments] = useState('');
  const [contact, setContact] = useState(true);
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const { data, error: loadError } = await createClient()
        .from('questions')
        .select('*')
        .eq('form_source', 'inpatient')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (loadError || !data?.length) {
        setQuestions(fallbackQuestions());
        setLoading(false);
        return;
      }

      const rows = (data as QuestionRow[]).filter((q) => q.question_type !== 'text');
      setQuestions(rows.length ? rows : fallbackQuestions());
      setLoading(false);
    }
    load();
  }, []);

  const totalQuestionSteps = questions.length;
  const commentStep = totalQuestionSteps;
  const totalSteps = totalQuestionSteps + 1;
  const currentQuestion = questions[step];
  const answerKey = currentQuestion?.slug || currentQuestion?.id;

  const progress = useMemo(
    () => Array.from({ length: totalSteps }, (_, index) => index),
    [totalSteps]
  );

  const setAnswer = (id: string, value: string) => {
    setAnswers((current) => ({ ...current, [id]: value }));
    setError('');
  };

  const goNext = () => {
    if (step < totalQuestionSteps) {
      if (!answerKey || !answers[answerKey]) {
        setError('Please choose a response to continue.');
        return;
      }
    }
    setError('');
    setStep((current) => Math.min(current + 1, commentStep));
  };

  const goBack = () => {
    setError('');
    setStep((current) => Math.max(current - 1, 0));
  };

  const submit = async () => {
    setError('');
    setSubmitting(true);
    const inpatientAnswers: Answers = {};
    for (const question of questions) {
      const key = question.slug || question.id;
      if (answers[key]) inpatientAnswers[key] = answers[key];
    }
    const { error: saveError } = await createClient().from('submissions').insert({
      source: 'inpatient',
      inpatient_answers: inpatientAnswers,
      comment: comments.trim() || null,
      contact_phone: contact && phone.trim() ? phone.trim() : null,
    });
    setSubmitting(false);
    if (saveError) {
      setError("We couldn't submit your feedback. Please try again.");
      return;
    }
    setSubmitted(true);
  };

  if (loading) {
    return (
      <main className="page-shell">
        <div className="app-frame">
          <p className="p-8 text-sm text-[var(--muted)]">Loading feedback form…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="ambient-mark" aria-hidden="true">
        ✚
      </div>
      <div className="app-frame">
        <header className="site-header">
          <div className="brand">
            <img src="/value-family-hospital-logo.png" alt="Value Family Hospital logo" />
            <div>
              <strong>Value Family Hospital</strong>
              <span>Service with a Difference</span>
            </div>
          </div>
          <span className="header-note">
            <Heart size={15} fill="currentColor" /> Service with a difference
          </span>
        </header>

        <div className="content-wrap">
          <div className="survey-card">
            {submitted ? (
              <div className="thank-you">
                <div className="thank-icon">
                  <Heart size={42} fill="currentColor" />
                </div>
                <span className="eyebrow">FEEDBACK RECEIVED</span>
                <h1>Thank You!</h1>
                <p>Your feedback helps us provide better care every day.</p>
                <p>
                  We appreciate you choosing <strong>Value Family Hospital.</strong>
                </p>
                <button
                  className="button button-plum"
                  onClick={() => {
                    setSubmitted(false);
                    setStep(0);
                    setAnswers({});
                    setComments('');
                    setPhone('');
                    setContact(true);
                  }}
                >
                  Start again <ArrowRight size={18} />
                </button>
              </div>
            ) : (
              <div className="survey-body">
                <div className="step-top">
                  {step > 0 ? (
                    <button className="top-back" onClick={goBack}>
                      <ChevronLeft size={21} /> Back
                    </button>
                  ) : (
                    <span />
                  )}
                  <span>
                    {step + 1} of {totalSteps}
                  </span>
                </div>
                <div className="progress" aria-label={`Step ${step + 1} of ${totalSteps}`}>
                  {progress.map((item) => (
                    <span key={item} className={item < step ? 'filled' : ''} />
                  ))}
                </div>
                <div className="step-content" key={step}>
                  {step < totalQuestionSteps && currentQuestion && answerKey ? (
                    <Rating
                      title={currentQuestion.prompt}
                      id={answerKey}
                      options={currentQuestion.options?.length ? currentQuestion.options : [{ label: 'Yes' }, { label: 'No' }]}
                      value={answers[answerKey]}
                      onChange={setAnswer}
                    />
                  ) : null}
                  {step === commentStep ? (
                    <div className="final-form">
                      <label className="field-label" htmlFor="comments">
                        Any additional comments
                        <br />
                        or suggestions?
                      </label>
                      <div className="textarea-wrap">
                        <textarea
                          id="comments"
                          placeholder="Write your comments here... (Optional)"
                          value={comments}
                          onChange={(e) => setComments(e.target.value)}
                        />
                        <MessageCircle size={34} aria-hidden="true" />
                      </div>
                      <fieldset className="contact-field">
                        <legend>
                          May we contact you if we need
                          <br />
                          more details about your feedback?
                        </legend>
                        <div className="segmented">
                          <button
                            type="button"
                            className={contact ? 'active' : ''}
                            onClick={() => {
                              setContact(true);
                              setError('');
                            }}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            className={!contact ? 'active' : ''}
                            onClick={() => {
                              setContact(false);
                              setError('');
                            }}
                          >
                            No
                          </button>
                        </div>
                      </fieldset>
                      {contact ? (
                        <label className="phone-field" htmlFor="phone">
                          Please provide your contact number:
                          <span>
                            <Phone size={18} />
                            <input
                              id="phone"
                              type="tel"
                              inputMode="tel"
                              placeholder="e.g. 0123 456 789"
                              value={phone}
                              onChange={(e) => {
                                setPhone(e.target.value);
                                setError('');
                              }}
                            />
                          </span>
                        </label>
                      ) : null}
                      <div className="mini-thanks">
                        <span>💜</span>
                        <p>
                          <strong>Thank you for sharing.</strong>
                          <br />
                          Your voice helps us care better.
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
                {error ? (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="step-actions">
                  {step > 0 ? (
                    <button className="button button-outline" onClick={goBack} disabled={submitting}>
                      <ArrowLeft size={18} /> Back
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    className={step === commentStep ? 'button button-gold' : 'button button-plum'}
                    onClick={step === commentStep ? submit : goNext}
                    disabled={submitting}
                  >
                    {step === commentStep
                      ? submitting
                        ? 'Submitting...'
                        : 'Submit Feedback'
                      : 'Next'}{' '}
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}
            <div className="wave" aria-hidden="true" />
          </div>
          <aside className="side-panel">
            <span className="side-kicker">VALUE FAMILY HOSPITAL</span>
            <h2>Every voice helps us care better.</h2>
            <p>
              We listen to each experience with care and use it to make every stay more comfortable.
            </p>
            <div className="side-detail">
              <span>✦</span>
              <div>
                <strong>Thoughtful care</strong>
                <small>For you and your loved ones</small>
              </div>
            </div>
            <div className="side-detail">
              <span>✦</span>
              <div>
                <strong>Meaningful feedback</strong>
                <small>A better experience for everyone</small>
              </div>
            </div>
            <div className="side-quote">“Service with a difference”</div>
          </aside>
        </div>
        <footer className="site-footer">
          <span>© 2026 Value Family Hospital</span>
          <span>Service with a Difference</span>
        </footer>
      </div>
    </main>
  );
}
