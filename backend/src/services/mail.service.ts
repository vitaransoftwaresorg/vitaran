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
  /** `cid` makes an attachment usable inline as <img src="cid:…">. */
  attachments?: { filename: string; content: Buffer; contentType: string; cid?: string }[];
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
      ...(payload.attachments?.length ? { attachments: payload.attachments } : {}),
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

type NoticeRow = [label: string, value: string];

type Notice = {
  /** Shown in the header bar and the sign-off. */
  brand?: string;
  salutation: string;
  paragraphs: string[];
  detailsTitle?: string;
  rows: NoticeRow[];
  quote?: string | null;
  quoteLabel?: string;
  /** Inline image (sent as a `cid` attachment), shown under the quote. */
  image?: { cid: string; label: string } | null;
  closing?: string[];
  footer?: string;
};

const BRAND = "Vitaran Learning";
const NAVY = "#19205f";
const AUTOMATED_FOOTER = "This is an automated notification from Vitaran Learning.";

const today = () =>
  new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

/** Formal, link-free letter: brand bar, salutation, body, details table, remarks, sign-off. */
function noticeHtml(notice: Notice) {
  const brand = notice.brand ?? BRAND;
  const paragraph = (text: string) => `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#1f2937">${escapeHtml(text)}</p>`;
  const rows = notice.rows
    .map(
      ([label, value], index) =>
        `<tr style="background:${index % 2 ? "#ffffff" : "#f8fafc"}"><td style="padding:9px 14px;width:40%;font-size:13px;color:#475569;vertical-align:top">${escapeHtml(label)}</td><td style="padding:9px 14px;font-size:13px;font-weight:600;color:#0f172a">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const details = notice.rows.length
    ? `${notice.detailsTitle ? `<p style="margin:6px 0 8px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${NAVY}">${escapeHtml(notice.detailsTitle)}</p>` : ""}
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;border-collapse:separate;overflow:hidden;margin:0 0 18px">${rows}</table>`
    : "";
  const quote = notice.quote?.trim()
    ? `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${NAVY}">${escapeHtml(notice.quoteLabel ?? "Message")}</p>
      <p style="margin:0 0 18px;padding:12px 14px;background:#f8fafc;border-left:3px solid ${NAVY};font-size:14px;white-space:pre-wrap;line-height:1.6;color:#1f2937">${escapeHtml(notice.quote.trim())}</p>`
    : "";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Segoe UI,Arial,sans-serif;color:#1f2937">
  <table width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#ffffff">
    <tr><td style="background:${NAVY};padding:16px 20px">
      <p style="margin:0;font-size:16px;font-weight:700;letter-spacing:.04em;color:#ffffff">${escapeHtml(brand)}</p>
    </td></tr>
    <tr><td style="padding:22px 20px">
      <p style="margin:0 0 14px;font-size:14px;color:#1f2937">${escapeHtml(notice.salutation)}</p>
      ${notice.paragraphs.map(paragraph).join("")}
      ${details}
      ${quote}
      ${
        notice.image
          ? `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${NAVY}">${escapeHtml(notice.image.label)}</p>
      <p style="margin:0 0 18px"><img src="cid:${escapeHtml(notice.image.cid)}" alt="${escapeHtml(notice.image.label)}" style="display:block;max-width:100%;height:auto;border:1px solid #e2e8f0;border-radius:6px"></p>`
          : ""
      }
      ${(notice.closing ?? []).map(paragraph).join("")}
      <p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#1f2937">Regards,<br><strong>${escapeHtml(brand === BRAND ? "Team Vitaran Learning" : brand)}</strong></p>
    </td></tr>
    <tr><td style="padding:14px 20px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:11px;line-height:1.5;color:#94a3b8">${escapeHtml(notice.footer ?? AUTOMATED_FOOTER)}</p>
    </td></tr>
  </table>
</body>
</html>`;
}

function noticeText(notice: Notice) {
  const brand = notice.brand ?? BRAND;
  return [
    notice.salutation,
    "",
    ...notice.paragraphs.flatMap((text) => [text, ""]),
    ...(notice.rows.length
      ? [...(notice.detailsTitle ? [notice.detailsTitle.toUpperCase()] : []), ...notice.rows.map(([label, value]) => `${label}: ${value}`), ""]
      : []),
    ...(notice.quote?.trim() ? [`${notice.quoteLabel ?? "Message"}:`, notice.quote.trim(), ""] : []),
    ...(notice.image ? [`${notice.image.label}: attached to this email`, ""] : []),
    ...(notice.closing ?? []).flatMap((text) => [text, ""]),
    "Regards,",
    brand === BRAND ? "Team Vitaran Learning" : brand,
    "",
    "--",
    notice.footer ?? AUTOMATED_FOOTER,
  ].join("\n");
}

function sendNotice(
  to: string,
  subject: string,
  notice: Notice,
  extra: Pick<MailPayload, "replyTo" | "cc" | "attachments"> = {},
) {
  return sendMail({
    to,
    fromName: notice.brand ?? BRAND,
    subject,
    text: noticeText(notice),
    html: noticeHtml(notice),
    ...extra,
  });
}

const portalAddress = () => portalLoginUrl().replace(/^https?:\/\//, "");

/* ---------- School and teacher portal accounts ---------- */

/** Admin → school, sent as Vitaran Learning. */
export async function sendSchoolCredentialsEmail(input: {
  to: string;
  schoolName: string;
  loginEmail: string;
  loginPhone?: string | null;
  password: string;
  reason: "created" | "password-reset" | "resend";
}) {
  const reset = input.reason === "password-reset";
  const subject =
    input.reason === "created"
      ? `Welcome to Vitaran Learning – School Portal Access for ${input.schoolName}`
      : reset
        ? `Password Updated – ${input.schoolName} School Portal`
        : `School Portal Login Details – ${input.schoolName}`;
  const paragraphs =
    input.reason === "created"
      ? [
          `Welcome to Vitaran Learning. We are pleased to have ${input.schoolName} on board.`,
          "Your school portal account has been created. Through the portal you can manage your teachers and students, view answer keys and results, and raise objections on answer keys. Your sign-in details are given below.",
        ]
      : reset
        ? ["The password for your school portal account has been updated. Please use the details below to sign in."]
        : ["As requested, please find the sign-in details for your school portal account below."];
  return sendNotice(input.to, subject, {
    salutation: `Dear ${input.schoolName} Team,`,
    paragraphs,
    detailsTitle: "Sign-in details",
    rows: [
      ["Login email", input.loginEmail],
      ...(input.loginPhone ? ([["Login phone", input.loginPhone]] as NoticeRow[]) : []),
      ["Password", input.password],
      ["Portal", portalAddress()],
    ],
    closing: [
      "Please keep these credentials confidential and share them only with authorised staff.",
      ...(reset ? ["If you did not request this change, please contact Vitaran Learning immediately."] : []),
    ],
  });
}

/**
 * School → teacher: sent under the school's name, Reply-To the school's login email.
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
  const schoolEmail = input.schoolEmail?.trim() || null;
  const reset = input.reason === "password-reset";
  const subject =
    input.reason === "created"
      ? `Welcome to ${input.schoolName} – Teacher Portal Access`
      : reset
        ? `Password Updated – ${input.schoolName} Teacher Portal`
        : `Teacher Portal Login Details – ${input.schoolName}`;
  const paragraphs =
    input.reason === "created"
      ? [
          `Welcome to the ${input.schoolName} teacher portal, powered by Vitaran Learning.`,
          "Your teacher account has been created. Through the portal you can view your classes and students, answer keys and results, and raise objections on answer keys. Your sign-in details are given below.",
        ]
      : reset
        ? ["The password for your teacher portal account has been updated. Please use the details below to sign in."]
        : ["Please find the sign-in details for your teacher portal account below."];
  return sendNotice(
    input.to,
    subject,
    {
      brand: input.schoolName,
      salutation: `Dear ${input.teacherName},`,
      paragraphs,
      detailsTitle: "Sign-in details",
      rows: [
        ["School", input.schoolName],
        ["Login email", input.loginEmail],
        ...(input.loginPhone ? ([["Login phone", input.loginPhone]] as NoticeRow[]) : []),
        ["Password", input.password],
        ["Portal", portalAddress()],
      ],
      closing: ["Please keep these credentials confidential.", "For any help, simply reply to this email to reach the school office."],
      footer: `Sent by ${input.schoolName} through Vitaran Learning.`,
    },
    {
      replyTo: schoolEmail,
      cc: reset && schoolEmail && schoolEmail !== input.to ? schoolEmail : null,
    },
  );
}

/* ---------- Answer key objections ---------- */

const displayAnswer = (value: string | null | undefined) =>
  value === "NONE" ? "No correct option" : value === "ADD" ? "Marks for any attempt (ADD)" : value?.trim() || "—";

export type ObjectionRecipient = { email: string; name?: string | null; role: "vitaran" | "sme" };
export type PortalRecipient = { email: string; name: string; role: "school" | "teacher" };

type ObjectionSummary = {
  /** Short reference shown to everyone, e.g. "OBJ-1A2B3C4D". */
  reference: string;
  schoolName: string;
  programLabel: string;
  classLevel: number;
  testNumber: number;
  testId: string;
  questionNumber: number | null;
  subjectLabel: string | null;
  proposedAnswer: string | null;
};

const questionLabel = (q: number | null) => (q != null ? `Question ${q}` : "General");
const subjectTail = (input: ObjectionSummary) =>
  `Test ${input.testNumber}${input.questionNumber != null ? `, Q${input.questionNumber}` : ""}${input.subjectLabel ? ` (${input.subjectLabel})` : ""}`;

function objectionRows(input: ObjectionSummary): NoticeRow[] {
  return [
    ["Reference", input.reference],
    ["Program", input.programLabel],
    ["Class / Test", `Class ${input.classLevel} / Test ${input.testNumber}`],
    ...(input.testId ? ([["Test ID", input.testId]] as NoticeRow[]) : []),
    ["Question", questionLabel(input.questionNumber)],
    ...(input.subjectLabel ? ([["Subject", input.subjectLabel]] as NoticeRow[]) : []),
  ];
}

/** Vitaran is addressed as the organisation; SMEs by name. */
export async function sendObjectionAlertEmail(
  input: ObjectionSummary & {
    recipients: ObjectionRecipient[];
    schoolCode: string;
    raisedBy: string;
    teacherName?: string | null;
    currentAnswer: string | null;
    message: string;
    image?: { data: Buffer; mimeType: string } | null;
  },
) {
  if (input.recipients.length === 0) return false;
  const imageCid = "objection-image";
  const ext = input.image?.mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const attachments = input.image
    ? [{ filename: `${input.reference}.${ext}`, content: input.image.data, contentType: input.image.mimeType, cid: imageCid }]
    : undefined;
  const image = input.image ? { cid: imageCid, label: "Supporting image" } : null;
  const statementLabel = input.teacherName?.trim() ? `Explanation from ${input.teacherName.trim()}` : "Explanation from the school";
  const raisedBy = input.teacherName?.trim() ? `${input.teacherName.trim()} (Teacher)` : `${input.raisedBy}`;
  const rows: NoticeRow[] = [
    ...objectionRows(input).slice(0, 1),
    ["School", `${input.schoolName} (${input.schoolCode})`],
    ["Raised by", raisedBy],
    ...objectionRows(input).slice(1),
    ...(input.questionNumber != null ? ([["Published answer", displayAnswer(input.currentAnswer)]] as NoticeRow[]) : []),
    ["Proposed answer", displayAnswer(input.proposedAnswer)],
    ["Received on", today()],
  ];
  const subject = `New Answer Key Objection – ${subjectTail(input)} – ${input.schoolName}`;
  const subjectName = input.subjectLabel ?? "your subject";

  const results = await Promise.all(
    input.recipients.map((recipient) =>
      recipient.role === "sme"
        ? sendNotice(recipient.email, subject, {
            salutation: `Dear ${recipient.name?.trim() || "Subject Expert"},`,
            paragraphs: [
              `An objection has been raised on a ${subjectName} question in one of our published answer keys.`,
              `As the Subject Matter Expert for ${subjectName}, we request you to review the question and share your recommendation with the Vitaran Learning team.`,
            ],
            detailsTitle: "Objection details",
            rows,
            quote: input.message,
            quoteLabel: statementLabel,
            image,
            closing: ["Thank you for your support in keeping our assessments accurate."],
            footer: `You are receiving this email as the registered ${subjectName} Subject Matter Expert for Vitaran Learning.`,
          }, { attachments })
        : sendNotice(recipient.email, subject, {
            salutation: "Dear Vitaran Learning Team,",
            paragraphs: ["A new objection has been raised against a published answer key. The details are given below for review."],
            detailsTitle: "Objection details",
            rows,
            quote: input.message,
            quoteLabel: statementLabel,
            image,
            closing: ["Please review the objection and record the decision in the admin console. The school will be informed of the decision by email."],
            footer: "This address is registered to receive all answer key objection notifications for Vitaran Learning.",
          }, { attachments }),
    ),
  );
  return results.some(Boolean);
}

/** Confirmation when an admin registers an address on the Vitaran or SME objection list. */
export async function sendObjectionOnboardingEmail(input: {
  to: string;
  role: "vitaran" | "sme";
  name?: string | null;
  subjectLabel?: string | null;
}) {
  if (input.role === "vitaran") {
    return sendNotice(input.to, "Objection Notifications Enabled – Vitaran Learning", {
      salutation: "Dear Vitaran Learning Team,",
      paragraphs: [
        "This is to confirm that this email address has been registered to receive answer key objection notifications on behalf of Vitaran Learning.",
        "From now on, a notification will be sent to this address whenever a school or teacher raises an objection against a published answer key.",
      ],
      detailsTitle: "Registration details",
      rows: [
        ["Registered email", input.to],
        ["Notification scope", "All answer key objections"],
        ["Effective from", today()],
      ],
      closing: ["Each notification includes the school, program, class, test, question, the published answer and the proposed answer."],
      footer: "If this address was registered in error, please update the objection emails in the Vitaran admin settings.",
    });
  }
  const subjectName = input.subjectLabel ?? "the assigned subject";
  return sendNotice(input.to, `Registered as Subject Matter Expert – ${subjectName} | Vitaran Learning`, {
    salutation: `Dear ${input.name?.trim() || "Subject Expert"},`,
    paragraphs: [
      `We are pleased to inform you that you have been registered as the Subject Matter Expert (SME) for ${subjectName} at Vitaran Learning.`,
      `In this role, you will be notified whenever a school or teacher raises an objection on a ${subjectName} question in our answer keys. We request you to review each objection and share your expert recommendation with the Vitaran Learning team.`,
    ],
    detailsTitle: "Registration details",
    rows: [
      ["Role", "Subject Matter Expert (SME)"],
      ["Subject", subjectName],
      ["Registered email", input.to],
      ["Notification scope", `${subjectName} objections only`],
      ["Effective from", today()],
    ],
    closing: ["Thank you for supporting the quality and accuracy of our assessments."],
    footer: "If you believe this registration was made in error, please inform the Vitaran Learning team.",
  });
}

const portalSalutation = (recipient: PortalRecipient) =>
  recipient.role === "school" ? `Dear ${recipient.name} Team,` : `Dear ${recipient.name},`;

const portalFooter = (recipient: PortalRecipient, schoolName: string) =>
  recipient.role === "teacher"
    ? `You are receiving this email because you raised this objection on behalf of ${schoolName}.`
    : `You are receiving this email because an objection was raised from the ${schoolName} account.`;

/** Acknowledgement to the school (and the teacher who raised it). */
export async function sendObjectionReceivedEmail(input: ObjectionSummary & { recipients: PortalRecipient[]; message: string }) {
  const results = await Promise.all(
    input.recipients.map((recipient) =>
      sendNotice(recipient.email, `Objection Received – ${subjectTail(input)} | Ref ${input.reference}`, {
        salutation: portalSalutation(recipient),
        paragraphs: [
          "Thank you for bringing this to our attention. We have received your objection on the answer key detailed below.",
          "Our academic team, together with the subject expert, will review it carefully. You will be informed by email once a decision has been made.",
        ],
        detailsTitle: "Objection details",
        rows: [
          ...objectionRows(input),
          ["Proposed answer", displayAnswer(input.proposedAnswer)],
          ["Received on", today()],
          ["Status", "Under review"],
        ],
        quote: input.message,
        quoteLabel: "Your objection",
        closing: [`Please quote reference ${input.reference} in any communication about this objection.`],
        footer: portalFooter(recipient, input.schoolName),
      }),
    ),
  );
  return results.some(Boolean);
}

/** Decision to the school (and the teacher who raised it), with Vitaran's remarks. */
export async function sendObjectionDecisionEmail(
  input: ObjectionSummary & {
    recipients: PortalRecipient[];
    accepted: boolean;
    keyUpdated: boolean;
    newAnswer: string | null;
    note: string;
  },
) {
  const outcome = input.accepted ? "Accepted" : "Not Accepted";
  const paragraphs = input.accepted
    ? [
        "Thank you for your objection. After careful review, our academic team has accepted it.",
        input.keyUpdated
          ? "The answer key has been corrected, and results will reflect the revised answer."
          : "The necessary action has been taken on the answer key.",
      ]
    : [
        "Thank you for your objection. After careful review, our academic team has concluded that the published answer is correct.",
        "The answer key will therefore remain unchanged.",
      ];
  const results = await Promise.all(
    input.recipients.map((recipient) =>
      sendNotice(recipient.email, `Objection ${outcome} – ${subjectTail(input)} | Ref ${input.reference}`, {
        salutation: portalSalutation(recipient),
        paragraphs,
        detailsTitle: "Decision summary",
        rows: [
          ...objectionRows(input),
          ["Proposed answer", displayAnswer(input.proposedAnswer)],
          ["Decision", outcome],
          ...(input.keyUpdated && input.newAnswer ? ([["Revised answer", displayAnswer(input.newAnswer)]] as NoticeRow[]) : []),
          ["Decided on", today()],
        ],
        quote: input.note,
        quoteLabel: "Remarks from Vitaran Learning",
        closing: ["We appreciate your effort in helping us maintain the accuracy of our assessments."],
        footer: portalFooter(recipient, input.schoolName),
      }),
    ),
  );
  return results.some(Boolean);
}
