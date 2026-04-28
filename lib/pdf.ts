export function stripPdfExtension(filename: string) {
    return filename.toLowerCase().endsWith(".pdf")
        ? filename.slice(0, -4)
        : filename;
}
