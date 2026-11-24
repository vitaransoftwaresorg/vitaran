/** Form field names for customized school student-resource uploads. */

const CUSTOM_PROGRAM_TOKEN = "CUSTOM";

export function resourceFieldName(programCode: string, classLevel: number, subject: string) {
  return `studentResource__${programCode || CUSTOM_PROGRAM_TOKEN}__${classLevel}__${subject}`;
}

export function parseResourceFieldName(name: string) {
  const match = /^studentResource__([A-Z0-9_]+)__(\d+)__([A-Z0-9_]+)$/.exec(name);
  if (!match) return null;
  return {
    programCode: match[1]!,
    classLevel: Number(match[2]),
    subject: match[3]!,
  };
}

export { CUSTOM_PROGRAM_TOKEN };
