export const ANSWER_KEY_NOUN = "answer key";

export const ANSWER_KEYS_PATH = "/admin/answer-keys";

/** Photo attached to an objection, streamed through the portal's own session. */
export const objectionImageHref = (portal: "admin" | "school" | "teacher", objectionId: string) =>
  `/${portal}/answer-keys/objections/${encodeURIComponent(objectionId)}/image`;
export const ANSWER_KEY_UPLOAD_PATH = `${ANSWER_KEYS_PATH}/upload`;

/** Where a signed-in school views its answer keys (school portal). */
export const SCHOOL_ANSWER_KEYS_PATH = "/school/answer-keys";

/** Where a signed-in teacher views their answer keys (teacher portal). */
export const TEACHER_ANSWER_KEYS_PATH = "/teacher/answer-keys";
