import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}) {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set, skipping email send");
    return;
  }

  try {
    await resend.emails.send({
      from: "Leave Management <onboarding@resend.dev>",
      to,
      subject,
      text,
    });
  } catch (error) {
    console.error("[email] Failed to send email:", error);
  }
}
