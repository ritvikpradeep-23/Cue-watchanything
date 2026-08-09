import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

/** Best-effort notification email — never throws, so a flaky/unconfigured mail provider can't
 * break the actual action (sending a message, etc.), same convention as logActivity-style side
 * channels elsewhere in this app. No-ops quietly if RESEND_API_KEY isn't set (e.g. local dev). */
export async function sendNotificationEmail(to: string, subject: string, text: string): Promise<void> {
  if (!resend) return;
  try {
    await resend.emails.send({
      from: "Cue <notifications@resend.dev>",
      to,
      subject,
      text,
    });
  } catch (err) {
    console.error("sendNotificationEmail failed (non-fatal):", err);
  }
}
