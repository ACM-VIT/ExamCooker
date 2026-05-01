export function normalizeCourseCode(code: string) {
    return code.replace(/\s+/g, "").toUpperCase();
}
