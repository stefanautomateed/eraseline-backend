import nodemailer from "nodemailer";

// SES SMTP mailer. Aktivan samo ako su svi env varovi postavljeni:
//   SES_SMTP_HOST, SES_SMTP_PORT, SES_SMTP_USER, SES_SMTP_PASS, MAIL_FROM
// Opcioni:
//   MAIL_TEST_RECIPIENT — ako je postavljen, SVI mejlovi idu na tu adresu
//   umesto brokerima (sigurnosni ventil za testiranje).
// Bez env varova mailer je iskljucen i opt-out ostaje "prepared" (rucni flow).

const host = process.env.SES_SMTP_HOST;
const port = Number(process.env.SES_SMTP_PORT || 587);
const user = process.env.SES_SMTP_USER;
const pass = process.env.SES_SMTP_PASS;
const from = process.env.MAIL_FROM; // npr. 'Eraseline Privacy <privacy@mail.automateed.com>'
const testRecipient = process.env.MAIL_TEST_RECIPIENT;

const transporter = (host && user && pass && from)
  ? nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } })
  : null;

export function mailerEnabled() { return !!transporter; }
export function mailerMode() {
  if (!transporter) return "disabled";
  return testRecipient ? "test" : "live";
}

export async function sendOptOutEmail(optout, replyTo) {
  if (!transporter) return { sent: false, reason: "mailer_disabled" };
  const p = optout.payload || {};
  if (!p.to || !p.body) return { sent: false, reason: "no_email_payload" };

  let text = p.body;
  if (replyTo) text += `\n\nContact email for this request: ${replyTo}`;

  const to = testRecipient || p.to;
  const subject = testRecipient ? `[TEST → ${p.to}] ${p.subject}` : p.subject;

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      replyTo: replyTo || undefined
    });
    return { sent: true, messageId: info.messageId, testMode: !!testRecipient };
  } catch (e) {
    console.error(`SES send failed for ${optout.id}: ${e.message}`);
    return { sent: false, reason: e.message };
  }
}
