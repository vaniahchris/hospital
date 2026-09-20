'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { QuestionRow } from '@/lib/feedback';

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <svg className={className} width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === 'arrow' ? (
        <path d="M6 16h20m-7-7 7 7-7 7" />
      ) : name === 'back' ? (
        <path d="m20 7-9 9 9 9" />
      ) : name === 'lock' ? (
        <><rect x="8" y="14" width="16" height="14" rx="2" /><path d="M11 14V9a5 5 0 0 1 10 0v5m-5 5v4" /></>
      ) : name === 'heart' ? (
        <path fill="currentColor" strokeWidth="0" d="M16 28 4 16C-5 6 9-2 16 7 23-2 37 6 28 16Z" />
      ) : name === 'clock' ? (
        <><circle cx="16" cy="16" r="13" /><path d="M16 7v9l7 4" /></>
      ) : name === 'up' || name === 'down' ? (
        <g transform={name === 'down' ? 'rotate(180 16 16)' : undefined}>
          <path d="M10 27H5V13h5m0 14h13a3 3 0 0 0 3-2l3-11a2 2 0 0 0-2-3h-8l1-6c0-3-4-4-5-1l-5 9v14Z" />
        </g>
      ) : (
        <>
          <circle cx="16" cy="16" r="13" />
          <circle cx="11" cy="12" r="1" fill="currentColor" />
          <circle cx="21" cy="12" r="1" fill="currentColor" />
          {name === 'fair' || name === 'poor' ? <path d="M10 23q6-7 12 0" /> : <path d="M9 19q7 9 14 0" />}
        </>
      )}
    </svg>
  );
}

const emojiByName: Record<string, string> = {
  excellent: '🤩',
  veryGood: '😀',
  good: '🙂',
  fair: '😐',
  poor: '😞',
  clock: '🕐',
  definitely: '👍',
  probably: '👌',
  unsure: '🤔',
  probablyNot: '👎',
  definitelyNot: '🙅',
};

function AnswerEmoji({ name }: { name: string }) {
  return <span className="answer-emoji" aria-hidden="true">{emojiByName[name] ?? '•'}</span>;
}

function Brand() {
  return (
    <div className="brand">
      <svg viewBox="0 0 64 68" fill="none" aria-hidden="true">
        <path d="M25 2h13a5 5 0 0 1 5 5v16h15a5 5 0 0 1 5 5v13a5 5 0 0 1-5 5H43v16a5 5 0 0 1-5 5H25a5 5 0 0 1-5-5V46H5a5 5 0 0 1-5-5V28a5 5 0 0 1 5-5h15V7a5 5 0 0 1 5-5Z" fill="#1379dc" />
        <path d="M24 56c0-17 18-19 20-36-7 10-18 9-19 18m8 1c13 0 16-9 24-11" stroke="white" strokeWidth="2.7" strokeLinecap="round" />
      </svg>
      <div>
        <strong>Ndejje <span>Health Centre</span></strong>
        <small>Care Today. A Healthier Tomorrow</small>
      </div>
    </div>
  );
}

function Illustration() {
  return (
    <svg className="illustration" viewBox="0 0 280 200" fill="none" aria-hidden="true">
      <path d="M39 97C65 69 77 21 121 22c46-1 44 33 73 43 66 23 73 77 30 104-32 22-132 22-166 4-35-18-40-52-19-76Z" fill="#e0eeff" />
      <g transform="rotate(-5 126 108)">
        <rect x="80" y="42" width="107" height="139" rx="11" fill="#bddbff" />
        <rect x="74" y="38" width="107" height="139" rx="11" fill="white" stroke="#0c6dce" strokeWidth="4" />
        <rect x="81" y="45" width="93" height="123" rx="6" stroke="#e1efff" strokeWidth="3" />
        <path d="M100 35a7 7 0 0 1 7-7h12v-4a12 12 0 0 1 24 0v4h11a7 7 0 0 1 7 7v10h-61Z" fill="#1379dc" />
        <circle cx="131" cy="23" r="4" fill="white" />
        {[79, 106, 133].map((y) => (
          <g key={y}>
            <rect x="92" y={y} width="13" height="13" rx="2" stroke="#147ad9" strokeWidth="2.5" />
            <path d={`m95 ${y + 5} 4 4 9-11`} stroke="#147ad9" strokeWidth="2.5" />
            <path d={`M116 ${y + 3}h42M116 ${y + 10}h25`} stroke="#c5dfff" strokeWidth="3" strokeLinecap="round" />
          </g>
        ))}
      </g>
      <path d="M197 175s-37-25-37-48c0-23 27-27 37-9 13-18 37-12 37 9 0 23-37 48-37 48Z" fill="#1684ed" stroke="white" strokeWidth="3" />
    </svg>
  );
}

export default function Home() {
  const [step, setStep] = useState(0);
  const [choiceQuestions, setChoiceQuestions] = useState<QuestionRow[]>([]);
  const [textQuestion, setTextQuestion] = useState<QuestionRow | null>(null);
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  const totalSteps = choiceQuestions.length + 1;
  const successStep = totalSteps + 1;
  const isCommentStep = step === totalSteps;
  const question = choiceQuestions[step - 1];

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error || !data?.length) {
        setLoading(false);
        return;
      }

      const rows = data as QuestionRow[];
      const choices = rows.filter((q) => q.question_type !== 'text');
      const text = rows.find((q) => q.question_type === 'text') ?? null;
      setChoiceQuestions(choices);
      setTextQuestion(text);
      setAnswers(choices.map(() => null));
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (mounted.current) heading.current?.focus();
    mounted.current = true;
  }, [step]);

  function restart() {
    setAnswers(choiceQuestions.map(() => null));
    setComments('');
    setSubmitError('');
    setStep(0);
  }

  async function completeFeedback() {
    setSubmitting(true);
    setSubmitError('');
    const supabase = createClient();
    const submissionId = crypto.randomUUID();

    const { error: submissionError } = await supabase
      .from('submissions')
      .insert({ id: submissionId, comment: comments.trim() || null });

    if (submissionError) {
      setSubmitting(false);
      setSubmitError(submissionError.message);
      return;
    }

    const rows = choiceQuestions
      .map((q, index) => ({
        submission_id: submissionId,
        question_id: q.id,
        value: answers[index] ?? '',
      }))
      .filter((row) => row.value);

    if (textQuestion && comments.trim()) {
      rows.push({
        submission_id: submissionId,
        question_id: textQuestion.id,
        value: comments.trim(),
      });
    }

    if (rows.length) {
      const { error: answersError } = await supabase.from('answers').insert(rows);
      if (answersError) {
        setSubmitting(false);
        setSubmitError(answersError.message);
        return;
      }
    }

    setSubmitting(false);
    setStep(successStep);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (isCommentStep) {
      await completeFeedback();
      return;
    }
    if (answers[step - 1]) setStep(step + 1);
  }

  if (loading) {
    return (
      <main className="page">
        <div className="app-shell">
          <section className="feedback-card welcome" aria-label="Loading feedback">
            <Brand />
            <p>Loading questions…</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="app-shell">
        <div className="desktop-brand">
          <Brand />
          <span className="care-label"><span /> Listening. Caring. Improving.</span>
        </div>
        <section
          className={`feedback-card ${step === 0 ? 'welcome' : ''} ${step >= totalSteps ? 'closing-card' : ''}`}
          aria-label="Patient feedback"
        >
          {step === 0 ? (
            <>
              <Brand />
              <div className="welcome-copy">
                <span className="eyebrow">BETTER CARE STARTS WITH YOU</span>
                <h1 ref={heading} tabIndex={-1}>Your Feedback<br />Matters</h1>
                <p>
                  Help us improve our services by<br className="wide-break" /> sharing your experience.<br />
                  It only takes a minute.
                </p>
              </div>
              <Illustration />
              <button className="primary" onClick={() => setStep(1)} disabled={!choiceQuestions.length}>
                Start Feedback <Icon name="arrow" />
              </button>
              <p className="privacy"><Icon name="lock" /> Your responses are anonymous</p>
              <div className="wave" />
            </>
          ) : step === successStep ? (
            <div className="success">
              <Brand />
              <div className="heart-badge"><Icon name="heart" /></div>
              <span className="eyebrow">EVERY VOICE MAKES A DIFFERENCE</span>
              <h1 ref={heading} tabIndex={-1}>Thank You!</h1>
              <p>Your feedback helps us provide<br />better care for everyone.</p>
              <button className="primary" onClick={restart}>Back to Home <Icon name="arrow" /></button>
              <p className="community">Together for a Healthier Community</p>
              <div className="wave" />
            </div>
          ) : (
            <>
              <div className="step-header">
                <button className="back" onClick={() => setStep(step - 1)} type="button">
                  <Icon name="back" />Back
                </button>
                <span>{step} of {totalSteps}</span>
              </div>
              <div
                className="progress"
                role="progressbar"
                aria-label="Feedback progress"
                aria-valuenow={step}
                aria-valuemin={0}
                aria-valuemax={totalSteps}
              >
                {Array.from({ length: totalSteps }, (_, i) => i + 1).map((n) => (
                  <span className={n <= step ? 'filled' : ''} key={n} />
                ))}
              </div>
              <form onSubmit={onSubmit}>
                <h1 className="question" ref={heading} tabIndex={-1} id="question">
                  {isCommentStep
                    ? textQuestion?.prompt ?? 'Any additional comments or suggestions?'
                    : question.prompt}
                </h1>
                {!isCommentStep ? (
                  <fieldset aria-labelledby="question">
                    <legend className="sr-only">Select one answer</legend>
                    {question.options.map((option, index) => (
                      <label
                        className={`option ${answers[step - 1] === option.label ? 'selected' : ''}`}
                        key={option.label}
                      >
                        <input
                          type="radio"
                          name={`question-${step}`}
                          value={option.label}
                          checked={answers[step - 1] === option.label}
                          onChange={() =>
                            setAnswers((previous) =>
                              previous.map((answer, i) => (i === step - 1 ? option.label : answer))
                            )
                          }
                        />
                        <AnswerEmoji name={option.icon ?? question.options[index]?.icon ?? 'good'} />
                        <span>{option.label}</span>
                        {answers[step - 1] === option.label && (
                          <span className="selection-check" aria-hidden="true">✓</span>
                        )}
                      </label>
                    ))}
                  </fieldset>
                ) : (
                  <>
                    <label className="sr-only" htmlFor="comments">Your comments (optional)</label>
                    <textarea
                      id="comments"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder={'Write your comments here…\n(Optional)'}
                      maxLength={2000}
                    />
                    <div className="comment-meta">
                      <span>Please avoid including personal details.</span>
                      <span>{comments.length}/2000</span>
                    </div>
                  </>
                )}
                {submitError && <p className="answer-hint" role="alert">{submitError}</p>}
                <button
                  type="submit"
                  className="primary next"
                  disabled={(!isCommentStep && !answers[step - 1]) || submitting}
                >
                  {isCommentStep ? (submitting ? 'Saving…' : 'Complete Feedback') : 'Next'}
                  {!isCommentStep && <Icon name="arrow" />}
                </button>
                {!isCommentStep && <p className="answer-hint">Select an answer to continue</p>}
              </form>
              {isCommentStep && (
                <>
                  <div className="thank-you">
                    <div className="heart-badge"><Icon name="heart" /></div>
                    <div>
                      <h2>Your voice matters.</h2>
                      <p>Your feedback helps us provide better care for everyone.</p>
                    </div>
                  </div>
                  <p className="community">Together for a Healthier Community</p>
                  <div className="wave" />
                </>
              )}
            </>
          )}
        </section>
        <footer>Ndejje Health Centre <span>•</span> Care that puts you first</footer>
      </div>
    </main>
  );
}
