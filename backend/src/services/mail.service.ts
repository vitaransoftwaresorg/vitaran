import nodemailer from "nodemailer";
import { env, getCorsOrigins } from "../config/env.js";
import { logger } from "../utils/logger.js";

type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Display name for From (SMTP address stays the configured mailbox). */
  fromName?: string;
  replyTo?: string | null;
  cc?: string | null;
};

function appBaseUrl() {
  return (env.APP_URL ?? getCorsOrigins()[0] ?? "http://localhost:3000").replace(/\/$/, "");
}

function portalLoginUrl() {
  return `${appBaseUrl()}/school/login`;
}

function smtpConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

function createTransport() {
  if (!smtpConfigured()) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

function smtpAddress() {
  return env.SMTP_USER ?? "noreply@vitaranlearning.com";
}

function formatFrom(fromName?: string) {
  const address = smtpAddress();
  if (!fromName) return env.SMTP_FROM || address;
  // Keep authenticated SMTP mailbox; show school/platform name as sender label.
  return `"${fromName.replaceAll('"', "")}" <${address}>`;
}

/** Sends mail when SMTP is configured. Returns false on skip/failure. */
export async function sendMail(payload: MailPayload): Promise<boolean> {
  const transport = createTransport();
  if (!transport) {
    logger.warn({ to: payload.to, subject: payload.subject }, "SMTP not configured; skipping email");
    return false;
  }

  try {
    await transport.sendMail({
      from: formatFrom(payload.fromName),
      to: payload.to,
      ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
      ...(payload.cc ? { cc: payload.cc } : {}),
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    logger.info(
      { to: payload.to, cc: payload.cc ?? undefined, subject: payload.subject },
      "Email sent",
    );
    return true;
  } catch (error) {
    logger.error({ err: error, to: payload.to, subject: payload.subject }, "Failed to send email");
    return false;
  }
}

export function isSmtpConfigured() {
  return smtpConfigured();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function credentialsHtml(params: {
  brand: string;
  greeting: string;
  intro: string;
  loginId: string;
  password: string;
  footerNote: string;
  loginUrl?: string;
  loginLabel?: string;
}) {
  const loginUrl = params.loginUrl ?? portalLoginUrl();
  const loginLabel = params.loginLabel ?? "Login email";
  return `<!DOCTYPE html>
<html>
<body style="font-family:Segoe UI,Arial,sans-serif;background:#f6f7fb;padding:24px;color:#171717">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb">
    <tr><td style="padding:28px 28px 8px">
      <p style="margin:0 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#64748b">${escapeHtml(params.brand)}</p>
      <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a">${escapeHtml(params.greeting)}</h1>
      <p style="margin:0 0 16px;line-height:1.5">${escapeHtml(params.intro)}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin:0 0 20px">
        <tr><td style="padding:16px 18px">
          <p style="margin:0 0 8px;font-size:13px;color:#64748b">${escapeHtml(loginLabel)}</p>
          <p style="margin:0 0 14px;font-size:16px;font-weight:600">${escapeHtml(params.loginId)}</p>
          <p style="margin:0 0 8px;font-size:13px;color:#64748b">Password</p>
          <p style="margin:0;font-size:16px;font-weight:600;font-family:ui-monospace,Consolas,monospace">${escapeHtml(params.password)}</p>
        </td></tr>
      </table>
      <p style="margin:0 0 20px"><a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#19205f;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">Open portal sign in</a></p>
      <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5">${escapeHtml(params.footerNote)}</p>
    </td></tr>
  </table>
</body>
</html>`;
}

function otpHtml(params: { brand: string; otp: string; minutes: number }) {
  return `<!DOCTYPE html>
<html>
<body style="font-family:Segoe UI,Arial,sans-serif;background:#f6f7fb;padding:24px;color:#171717">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb">
    <tr><td style="padding:28px">
      <p style="margin:0 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#64748b">${escapeHtml(params.brand)}</p>
      <h1 style="margin:0 0 12px;font-size:22px;color:#0f172a">Password reset code</h1>
      <p style="margin:0 0 16px;line-height:1.5">Enter this one-time code to verify your email. It expires in ${params.minutes} minutes.</p>
      <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:0.35em;font-family:ui-monospace,Consolas,monospace;color:#19205f">${escapeHtml(params.otp)}</p>
      <p style="margin:0;font-size:13px;color:#64748b">If you did not request this, you can ignore this email.</p>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Admin → school: branded / sent as Vitaran Learning. */
export async function sendSchoolCredentialsEmail(input: {
  to: string;
  schoolName: string;
  loginEmail: string;
  loginPhone?: string | null;
  password: string;
  reason: "created" | "password-reset" | "resend";
}) {
  const brand = "Vitaran Learning";
  const subject =
    input.reason === "password-reset"
      ? `Your school password was updated — ${input.schoolName}`
      : `Your school portal account — ${input.schoolName}`;
  const greeting =
    input.reason === "password-reset"
      ? "Password updated"
      : input.reason === "resend"
        ? `Login details for ${input.schoolName}`
        : `Welcome, ${input.schoolName}`;
  const intro =
    input.reason === "password-reset"
      ? "Vitaran Learning set a new password for your school portal. Use it below to sign in."
      : "Vitaran Learning created your school portal account. Keep these details safe.";

  const text = [
    brand,
    greeting,
    "",
    `Login email: ${input.loginEmail}`,
    input.loginPhone ? `Phone: ${input.loginPhone}` : "",
    `Password: ${input.password}`,
    `Sign in: ${portalLoginUrl()}`,
  ]
    .filter(Boolean)
    .join("\n");

  return sendMail({
    to: input.to,
    fromName: brand,
    subject,
    text,
    html: credentialsHtml({
      brand,
      greeting,
      intro,
      loginId: input.loginEmail,
      password: input.password,
      footerNote: "Sent by Vitaran Learning. If you did not expect this email, contact support.",
    }),
  });
}

/**
 * School → teacher: appears from the school (display name + Reply-To = school login email).
 * On password reset, the school mailbox is CC'd so they also receive the new password.
 */
export async function sendTeacherCredentialsEmail(input: {
  to: string;
  teacherName: string;
  schoolName: string;
  /** School login email — used as Reply-To and CC on password resets. */
  schoolEmail?: string | null;
  loginEmail: string;
  loginPhone?: string | null;
  password: string;
  reason: "created" | "password-reset" | "resend";
}) {
  const brand = input.schoolName;
  const schoolEmail = input.schoolEmail?.trim() || null;
  const subject =
    input.reason === "password-reset"
      ? `Your teacher password was updated — ${input.schoolName}`
      : `Your teacher portal account — ${input.schoolName}`;
  const greeting =
    input.reason === "password-reset"
      ? "Password updated"
      : input.reason === "resend"
        ? `Login details for ${input.teacherName}`
        : `Welcome, ${input.teacherName}`;
  const intro =
    input.reason === "password-reset"
      ? `${input.schoolName} set a new password for your teacher portal. Use it below to sign in.`
      : `${input.schoolName} created your teacher portal account. Keep these details safe.`;

  const text = [
    brand,
    greeting,
    "",
    `School: ${input.schoolName}`,
    `Login email: ${input.loginEmail}`,
    input.loginPhone ? `Phone: ${input.loginPhone}` : "",
    `Password: ${input.password}`,
    `Sign in: ${portalLoginUrl()}`,
  ]
    .filter(Boolean)
    .join("\n");

  const teacherSent = await sendMail({
    to: input.to,
    fromName: brand,
    replyTo: schoolEmail,
    // School also receives the new password when it changes (forgot-password / reset).
    cc: input.reason === "password-reset" && schoolEmail && schoolEmail !== input.to ? schoolEmail : null,
    subject,
    text,
    html: credentialsHtml({
      brand,
      greeting,
      intro,
      loginId: input.loginEmail,
      password: input.password,
      footerNote: `Sent by ${input.schoolName}. Reply to this email to reach your school.`,
    }),
  });

  return teacherSent;
}

export async function sendPasswordResetOtpEmail(input: {
  to: string;
  brand: string;
  otp: string;
  minutes?: number;
  /** For teacher OTP: school login email as Reply-To. */
  replyTo?: string | null;
  fromName?: string;
}) {
  const minutes = input.minutes ?? 10;
  return sendMail({
    to: input.to,
    fromName: input.fromName ?? input.brand,
    replyTo: input.replyTo,
    subject: `${input.brand} — password reset code`,
    text: `Your password reset code is ${input.otp}. It expires in ${minutes} minutes.`,
    html: otpHtml({ brand: input.brand, otp: input.otp, minutes }),
  });
}

export async function sendObjectionAlertEmail(input: {
  to: string[];
  schoolName: string;
  schoolCode: string;
  raisedBy: string;
  teacherName?: string | null;
  programCode: string;
  testNumber: number;
  testId: string;
  classLevel: number;
  questionNumber: number | null;
  subjectLabel: string | null;
  proposedAnswer: string | null;
  message: string;
  adminObjectionsUrl: string;
}) {
  const recipients = [...new Set(input.to.map((row) => row.trim().toLowerCase()).filter(Boolean))];
  if (recipients.length === 0) return false;

  const who =
    input.teacherName?.trim()
      ? `${input.raisedBy} (${input.teacherName.trim()})`
      : input.raisedBy;
  const question =
    input.questionNumber != null
      ? `Q${input.questionNumber}${input.subjectLabel ? ` · ${input.subjectLabel}` : ""}`
      : "General";
  const claim =
    input.proposedAnswer === "NONE"
      ? "No right answer"
      : input.proposedAnswer?.trim() || "—";

  const subject = `Objection · Test ${input.testNumber} · ${question} · ${input.schoolName}`;
  const lines = [
    `School: ${input.schoolName} (${input.schoolCode})`,
    `Raised by: ${who}`,
    `Key: ${input.programCode} · Test ${input.testNumber}${input.testId ? ` · ${input.testId}` : ""} · Class ${input.classLevel}`,
    `Question: ${question}`,
    `Claims: ${claim}`,
    "",
    input.message.trim(),
    "",
    `Review: ${input.adminObjectionsUrl}`,
  ];

  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#171717">
      <p style="margin:0 0 12px"><strong>New answer key objection</strong></p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:4px 12px 4px 0;color:#737373">School</td><td>${escapeHtml(input.schoolName)} (${escapeHtml(input.schoolCode)})</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#737373">Raised by</td><td>${escapeHtml(who)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#737373">Key</td><td>${escapeHtml(input.programCode)} · Test ${input.testNumber}${input.testId ? ` · ${escapeHtml(input.testId)}` : ""} · Class ${input.classLevel}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#737373">Question</td><td>${escapeHtml(question)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#737373">Claims</td><td>${escapeHtml(claim)}</td></tr>
      </table>
      <p style="margin:16px 0 8px;white-space:pre-wrap">${escapeHtml(input.message.trim())}</p>
      <p style="margin:16px 0 0"><a href="${escapeHtml(input.adminObjectionsUrl)}">Open objections inbox</a></p>
    </div>
  `;

  const results = await Promise.all(
    recipients.map((to) =>
      sendMail({
        to,
        fromName: "Vitaran Learning",
        subject,
        text: lines.join("\n"),
        html,
      }),
    ),
  );
  return results.some(Boolean);
}
