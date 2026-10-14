"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, Heart, MessageCircle, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Answers = Record<string, string>;

const careOptions = [
  { label: "Excellent", emoji: "😃", color: "plum" },
  { label: "Very Good", emoji: "🙂", color: "teal" },
  { label: "Good", emoji: "😊", color: "gold" },
  { label: "Fair", emoji: "😐", color: "teal" },
  { label: "Poor", emoji: "☹️", color: "plum" },
];

const recommendationOptions = [
  { label: "Very Likely", emoji: "👍", color: "plum" },
  { label: "Likely", emoji: "👍", color: "teal" },
  { label: "Maybe", emoji: "😐", color: "gold" },
  { label: "Unlikely", emoji: "👎", color: "teal" },
  { label: "Very Unlikely", emoji: "👎", color: "plum" },
];

function Rating({ title, id, options, value, onChange }: {
  title: string;
  id: string;
  options: typeof careOptions;
  value?: string;
  onChange: (id: string, value: string) => void;
}) {
  return <section className="rating-group" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>{title}</h2>
    <div className="options" role="radiogroup" aria-labelledby={`${id}-title`}>
      {options.map((option) => <button
        type="button"
        key={option.label}
        className={`rating-option ${value === option.label ? "selected" : ""}`}
        role="radio"
        aria-checked={value === option.label}
        onClick={() => onChange(id, option.label)}
      >
        <span className={`emoji-badge ${option.color}`} aria-hidden="true">{option.emoji}</span>
        <span>{option.label}</span>
        {value === option.label && <Check size={18} className="selection-check" aria-hidden="true" />}
      </button>)}
    </div>
  </section>;
}

export default function InpatientFeedback() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [comments, setComments] = useState("");
  const [contact, setContact] = useState(true);
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const setAnswer = (id: string, value: string) => {
    setAnswers((current) => ({ ...current, [id]: value }));
    setError("");
  };
  const goNext = () => {
    const required = step === 0 ? ["care"] : step === 1 ? ["staff", "room"] : step === 2 ? ["recommend"] : [];
    if (required.some((id) => !answers[id])) {
      setError("Please choose a response to continue.");
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, 3));
  };
  const goBack = () => {
    setError("");
    setStep((current) => Math.max(current - 1, 0));
  };
  const submit = async () => {
    setError("");
    setSubmitting(true);
    const { error: saveError } = await createClient().from("submissions").insert({
      source: "inpatient",
      inpatient_answers: {
        care: answers.care,
        staff: answers.staff,
        room: answers.room,
        recommend: answers.recommend,
      },
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

  return <main className="page-shell">
    <div className="ambient-mark" aria-hidden="true">✚</div>
    <div className="app-frame">
      <header className="site-header">
        <div className="brand">
          <img src="/value-family-hospital-logo.png" alt="Value Family Hospital logo" />
          <div><strong>Value Family Hospital</strong><span>Service with a Difference</span></div>
        </div>
        <span className="header-note"><Heart size={15} fill="currentColor" /> Service with a difference</span>
      </header>

      <div className="content-wrap">
        <div className="survey-card">
          {submitted ? <div className="thank-you">
            <div className="thank-icon"><Heart size={42} fill="currentColor" /></div>
            <span className="eyebrow">FEEDBACK RECEIVED</span>
            <h1>Thank You!</h1>
            <p>Your feedback helps us provide better care every day.</p>
            <p>We appreciate you choosing <strong>Value Family Hospital.</strong></p>
            <button className="button button-plum" onClick={() => { setSubmitted(false); setStep(0); setAnswers({}); setComments(""); setPhone(""); setContact(true); }}>Start again <ArrowRight size={18} /></button>
          </div> : <div className="survey-body">
            <div className="step-top">{step > 0 ? <button className="top-back" onClick={goBack}><ChevronLeft size={21} /> Back</button> : <span />}<span>{step + 1} of 4</span></div>
            <div className="progress" aria-label={`Step ${step + 1} of 4`}>{[0, 1, 2, 3].map((item) => <span key={item} className={item < step ? "filled" : ""} />)}</div>
            <div className="step-content" key={step}>
              {step === 0 && <Rating title="How would you rate the overall quality of care you received during your stay?" id="care" options={careOptions} value={answers.care} onChange={setAnswer} />}
              {step === 1 && <div className="two-questions">
                <Rating title="How would you rate the friendliness and professionalism of our staff?" id="staff" options={careOptions} value={answers.staff} onChange={setAnswer} />
                <Rating title="How would you rate the cleanliness and comfort of your room?" id="room" options={careOptions} value={answers.room} onChange={setAnswer} />
              </div>}
              {step === 2 && <Rating title="How likely are you to recommend Value Family Hospital to your friends or family?" id="recommend" options={recommendationOptions} value={answers.recommend} onChange={setAnswer} />}
              {step === 3 && <div className="final-form">
                <label className="field-label" htmlFor="comments">Any additional comments<br />or suggestions?</label>
                <div className="textarea-wrap"><textarea id="comments" placeholder="Write your comments here... (Optional)" value={comments} onChange={(e) => setComments(e.target.value)} /><MessageCircle size={34} aria-hidden="true" /></div>
                <fieldset className="contact-field"><legend>May we contact you if we need<br />more details about your feedback?</legend><div className="segmented"><button type="button" className={contact ? "active" : ""} onClick={() => { setContact(true); setError(""); }}>Yes</button><button type="button" className={!contact ? "active" : ""} onClick={() => { setContact(false); setError(""); }}>No</button></div></fieldset>
                {contact && <label className="phone-field" htmlFor="phone">Please provide your contact number:<span><Phone size={18} /><input id="phone" type="tel" inputMode="tel" placeholder="e.g. 0123 456 789" value={phone} onChange={(e) => { setPhone(e.target.value); setError(""); }} /></span></label>}
                <div className="mini-thanks"><span>💜</span><p><strong>Thank you for sharing.</strong><br />Your voice helps us care better.</p></div>
              </div>}
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="step-actions">{step > 0 ? <button className="button button-outline" onClick={goBack} disabled={submitting}><ArrowLeft size={18} /> Back</button> : <span />}<button className={step === 3 ? "button button-gold" : "button button-plum"} onClick={step === 3 ? submit : goNext} disabled={submitting}>{step === 3 ? (submitting ? "Submitting..." : "Submit Feedback") : "Next"} <ArrowRight size={18} /></button></div>
          </div>}
          <div className="wave" aria-hidden="true" />
        </div>
        <aside className="side-panel"><span className="side-kicker">VALUE FAMILY HOSPITAL</span><h2>Every voice helps us care better.</h2><p>We listen to each experience with care and use it to make every stay more comfortable.</p><div className="side-detail"><span>✦</span><div><strong>Thoughtful care</strong><small>For you and your loved ones</small></div></div><div className="side-detail"><span>✦</span><div><strong>Meaningful feedback</strong><small>A better experience for everyone</small></div></div><div className="side-quote">“Service with a difference”</div></aside>
      </div>
      <footer className="site-footer"><span>© 2026 Value Family Hospital</span><span>Service with a Difference</span></footer>
    </div>
  </main>;
}
