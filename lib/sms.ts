const GSM7 =
  /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà\r\n]*$/;

export const FEEDBACK_INVITE =
  'Value Family Hospital: please share feedback: https://feedback.valuefamilyhospital.com/';

export function countSmsParts(body: string): {
  encoding: 'gsm7' | 'ucs2';
  parts: number;
  length: number;
} {
  const gsm7 = GSM7.test(body);
  const length = gsm7 ? [...body].length : body.length;
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
  return FEEDBACK_INVITE;
}
