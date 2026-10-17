const GSM7 =
  /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà\r\n]*$/;

export const FEEDBACK_INVITE_BOTH =
  'Value Family Hospital: please share feedback. Outpatient: https://feedback.valuefamilyhospital.com/outpatient Inpatient: https://feedback.valuefamilyhospital.com/inpatient';

export const FEEDBACK_INVITE_OUTPATIENT =
  'Value Family Hospital: please share outpatient feedback: https://feedback.valuefamilyhospital.com/outpatient';

export const FEEDBACK_INVITE_INPATIENT =
  'Value Family Hospital: please share inpatient feedback: https://feedback.valuefamilyhospital.com/inpatient';

export function countSmsParts(body: string): {
  encoding: 'gsm7' | 'ucs2';
  parts: number;
  length: number;
} {
  const length = [...body].length;
  const gsm7 = GSM7.test(body);
  if (gsm7) {
    if (length <= 160) return { encoding: 'gsm7', parts: 1, length };
    return { encoding: 'gsm7', parts: Math.ceil(length / 153), length };
  }
  if (length <= 70) return { encoding: 'ucs2', parts: 1, length };
  return { encoding: 'ucs2', parts: Math.ceil(length / 67), length };
}

export function isWithinSmsPartLimit(body: string, maxParts = 3): boolean {
  return countSmsParts(body).parts <= maxParts;
}

export function pickFeedbackInviteBody(): string {
  if (isWithinSmsPartLimit(FEEDBACK_INVITE_BOTH)) return FEEDBACK_INVITE_BOTH;
  return FEEDBACK_INVITE_OUTPATIENT;
}
