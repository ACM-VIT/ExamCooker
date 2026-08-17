"use client";

export type PaperMetadataClassification = {
    confidence: number;
    examType: string | null;
    semester: string | null;
    year: number | null;
    slot: string | null;
    courseId: string | null;
    courseCode: string | null;
    courseTitle: string | null;
    evidence: string;
};

export type ClassifierResponse = {
    success: boolean;
    error?: string;
    result?: PaperMetadataClassification;
};

export function isSupportedClassifierSource(file: File) {
    return (
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf") ||
        file.type.startsWith("image/")
    );
}

function stripExtension(filename: string) {
    return filename.replace(/\.[^/.]+$/, "");
}

function canvasToJpeg(canvas: HTMLCanvasElement) {
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                    return;
                }
                reject(new Error("Could not prepare the paper header."));
            },
            "image/jpeg",
            0.9,
        );
    });
}

export async function prepareClassifierPdf(source: File) {
    if (
        source.type === "application/pdf" ||
        source.name.toLowerCase().endsWith(".pdf")
    ) {
        return source;
    }

    const bitmap = await createImageBitmap(source, {
        imageOrientation: "from-image",
    });

    try {
        const sourceHeight = Math.max(1, Math.floor(bitmap.height / 2));
        const targetWidth = Math.min(bitmap.width, 1600);
        const targetHeight = Math.max(
            1,
            Math.round(sourceHeight * (targetWidth / bitmap.width)),
        );
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is not available.");

        context.drawImage(
            bitmap,
            0,
            0,
            bitmap.width,
            sourceHeight,
            0,
            0,
            targetWidth,
            targetHeight,
        );

        const headerJpeg = await canvasToJpeg(canvas);
        const { PDFDocument } = await import("pdf-lib");
        const pdf = await PDFDocument.create();
        const image = await pdf.embedJpg(await headerJpeg.arrayBuffer());
        const page = pdf.addPage([image.width, image.height]);
        page.drawImage(image, {
            x: 0,
            y: 0,
            width: image.width,
            height: image.height,
        });
        const bytes = await pdf.save();

        return new File(
            [bytes.buffer as ArrayBuffer],
            `${stripExtension(source.name) || "paper"}-header.pdf`,
            { type: "application/pdf" },
        );
    } finally {
        bitmap.close();
    }
}

function setSelectValue(root: HTMLElement, value: string) {
    const select = Array.from(root.querySelectorAll("select")).find((candidate) =>
        Array.from(candidate.options).some((option) => option.value === value),
    );
    if (!select) return false;

    const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
    )?.set;
    valueSetter?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
}

function setTextInputValue(input: HTMLInputElement, value: string) {
    const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
    )?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
}

function nextPaint() {
    return new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
    });
}

async function setCourseValue(root: HTMLElement, courseCode: string) {
    const selectedCourse = Array.from(root.querySelectorAll("button")).find(
        (button) => button.textContent?.trim().toLowerCase() === "change",
    );
    if (selectedCourse) {
        const selectedContainer = selectedCourse.parentElement;
        if (selectedContainer?.textContent?.toUpperCase().includes(courseCode)) {
            return true;
        }
        selectedCourse.click();
        await nextPaint();
    }

    const input = root.querySelector<HTMLInputElement>(
        'input[aria-label="Search courses"]',
    );
    if (!input) return false;

    setTextInputValue(input, courseCode);
    await nextPaint();
    await nextPaint();

    const matchingOption = Array.from(root.querySelectorAll("li")).find((option) =>
        option.textContent?.toUpperCase().includes(courseCode),
    );
    if (!matchingOption) return false;

    matchingOption.dispatchEvent(
        new MouseEvent("mousedown", {
            bubbles: true,
            cancelable: true,
        }),
    );
    await nextPaint();

    return Array.from(root.querySelectorAll("button")).some((button) => {
        if (button.textContent?.trim().toLowerCase() !== "change") return false;
        return button.parentElement?.textContent
            ?.toUpperCase()
            .includes(courseCode);
    });
}

export async function applyPaperMetadata(
    root: HTMLElement,
    classification: PaperMetadataClassification,
) {
    const appliedFields: string[] = [];

    if (classification.courseCode) {
        const applied = await setCourseValue(
            root,
            classification.courseCode.toUpperCase(),
        );
        if (applied) appliedFields.push("course");
    }
    if (
        classification.examType &&
        setSelectValue(root, classification.examType)
    ) {
        appliedFields.push("exam type");
    }
    if (
        classification.semester &&
        setSelectValue(root, classification.semester)
    ) {
        appliedFields.push("semester");
    }
    if (
        classification.year !== null &&
        setSelectValue(root, classification.year.toString())
    ) {
        appliedFields.push("year");
    }
    if (classification.slot && setSelectValue(root, classification.slot)) {
        appliedFields.push("slot");
    }

    return appliedFields;
}
