/** Form field names for customized school student-resource uploads. */

export function resourceFieldName(classLevel: number, subject: string) {
  return `studentResource__${classLevel}__${subject}`;
}

export function parseResourceFieldName(name: string) {
  const match = /^studentResource__(\d+)__([A-Z0-9_]+)$/.exec(name);
  if (!match) return null;
  return { classLevel: Number(match[1]), subject: match[2]! };
}
