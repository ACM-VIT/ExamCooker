"use client";

import React, {
    useCallback,
    useEffect,
    useId,
    useReducer,
    useRef,
    useState,
    useTransition,
} from "react";
import Link from "next/link";
import { useDropzone, type FileRejection } from "react-dropzone";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowLeft,
    faCamera,
    faCircleXmark,
    faFilePdf,
    faImages,
    faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { useToast } from "@/app/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useGuestPrompt } from "@/app/components/auth-gate";
import CoursePicker, { type CourseOption } from "@/app/components/mod/course-picker";
import PhotoPageGrid from "@/app/components/upload/photo-page-grid";
import ScanPagesDialog from "@/app/components/upload/scan-pages-dialog";
import { EXAM_TYPE_OPTIONS } from "@/lib/exam-slug";
import {
    MAX_UPLOAD_PDF_BYTES,
    estimatePdfBytes,
    fitsUploadLimit,
    formatMegabytes,
    isHeicLike,
    unreadablePhotoMessage,
} from "@/lib/uploads/page-images";
import {
    UnreadablePhotoError,
    buildPhotoPdf,
    processPhotoPage,
} from "@/lib/uploads/page-image-encoding";
import {
    MAX_FILES_PER_UPLOAD,
    MAX_PAGES_PER_PAPER,
    buildNotesSaveBody,
    buildPastPaperSaveBody,
    createInitialUploadFormState,
    getPaperPages,
    getPaperProblems,
    getPaperTitle,
    isPageReady,
    isProcessingPages,
    remainingPageSlots,
    remainingPaperSlots,
    stripExtension,
    uploadFormReducer,
    type NewPage,
    type NoteDetails,
    type NoteDetailsField,
    type NoteDraft,
    type PaperDetails,
    type PaperDetailsField,
    type PaperDraft,
    type UploadFormAction,
    type UploadVariant,
} from "@/app/components/upload-form-state";

type UploadFileProps = {
    variant: UploadVariant;
    courses?: CourseOption[];
};

type UploadProcessResponse = {
    success: boolean;
    error?: string;
    receiptId?: string;
    result?: {
        fileUrl: string;
        thumbnailUrl: string | null;
        filename: string;
        message: string;
    };
};

type UploadSaveResponse = {
    success: boolean;
    error?: string;
    autoReview?: boolean;
};

type PaperFieldChange = <Field extends PaperDetailsField>(
    paperId: string,
    field: Field,
    value: PaperDetails[Field],
) => void;

type NoteFieldChange = <Field extends NoteDetailsField>(
    field: Field,
    value: NoteDetails[Field],
) => void;

const YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];
const SLOT_OPTIONS = [
    "A1",
    "A2",
    "B1",
    "B2",
    "C1",
    "C2",
    "D1",
    "D2",
    "E1",
    "E2",
    "F1",
    "F2",
    "G1",
    "G2",
];

const SEMESTERS = [
    { value: "FALL", label: "Fall" },
    { value: "WINTER", label: "Winter" },
    { value: "SUMMER", label: "Summer" },
    { value: "WEEKEND", label: "Weekend" },
];

const CAMPUSES = [
    { value: "CHENNAI", label: "Chennai" },
    { value: "AP", label: "AP" },
    { value: "BHOPAL", label: "Bhopal" },
    { value: "BANGALORE", label: "Bangalore" },
    { value: "MAURITIUS", label: "Mauritius" },
];

const SELECT_CLASS =
    "p-2 w-full bg-[#5FC4E7] dark:bg-[#008A90] cursor-pointer transition-colors duration-300 hover:bg-opacity-85 text-sm";
const LABEL_CLASS =
    "mb-1 block text-xs font-semibold uppercase tracking-wider text-black/60 dark:text-[#D5D5D5]/60";
const SECONDARY_BUTTON_CLASS =
    "inline-flex h-10 cursor-pointer items-center gap-2 border border-black/30 px-3 text-xs font-semibold hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#D5D5D5]/30 dark:hover:bg-white/5";
const PROCESSOR_SUCCESS_MESSAGE = "processed successfully";
const PROCESS_CONCURRENCY = 3;
const PDF_ACCEPT = { "application/pdf": [".pdf"] };
// No HEIC extensions here: iOS hands HEIC photos over as JPEG only when the
// input does not ask for HEIC.
const PDF_OR_IMAGE_ACCEPT = { "application/pdf": [".pdf"], "image/*": [] };
const IMAGE_ACCEPT = { "image/*": [] };

const isPdfFile = (file: File) =>
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
const isImageFile = (file: File) => file.type.startsWith("image/") || isHeicLike(file);

function getClipboardImageFiles(clipboardData: DataTransfer | null): File[] {
    if (!clipboardData) return [];

    const itemFiles = Array.from(clipboardData.items)
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);
    const files = itemFiles.length > 0
        ? itemFiles
        : Array.from(clipboardData.files);

    return files.filter(isImageFile);
}

function pdfFileName(title: string) {
    const base = title.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
    return `${base || "paper"}.pdf`;
}

async function mapWithConcurrency<T, R>(
    items: readonly T[],
    limit: number,
    run: (item: T, index: number) => Promise<R>,
) {
    const results = new Array<R>(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await run(items[index], index);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

async function processUpload(file: File, title: string) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("filetitle", title);
    const response = await fetch("/api/uploads/process", {
        method: "POST",
        body: formData,
    });
    const payload = (await response
        .json()
        .catch(() => null)) as UploadProcessResponse | null;
    if (
        !response.ok ||
        !payload?.success ||
        !payload.receiptId ||
        !payload.result
    ) {
        throw new Error(payload?.error ?? "Upload processing failed.");
    }
    if (payload.result.message !== PROCESSOR_SUCCESS_MESSAGE) {
        throw new Error(payload.result.message);
    }
    return payload.receiptId;
}

function UploadHeader({
    formId,
    pending,
    disabled,
    variant,
}: {
    formId: string;
    pending: boolean;
    disabled: boolean;
    variant: UploadVariant;
}) {
    const href = variant === "Past Papers" ? "/past_papers" : "/notes";

    return (
        <div className="mb-4 grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-4">
            <Link
                href={href}
                className="flex size-10 items-center justify-center border-2 border-[#3BF3C7] font-bold text-[#3BF3C7] hover:bg-[#ffffff]/10"
                aria-label={`Back to ${variant === "Past Papers" ? "past papers" : "notes"}`}
            >
                <FontAwesomeIcon icon={faArrowLeft} />
            </Link>
            <h3 className="truncate text-center text-base font-semibold sm:text-xl">
                New {variant}
            </h3>
            <div className="group relative">
                <div className="absolute inset-0 bg-[#0A0F1C] dark:bg-[#3BF4C7]" />
                <div className="duration-1000 transition dark:absolute dark:inset-0 dark:blur-[75px] dark:lg:bg-none dark:group-hover:duration-200 lg:dark:group-hover:bg-[#3BF4C7]" />
                <button
                    type="submit"
                    form={formId}
                    disabled={disabled}
                    className="relative whitespace-nowrap border-2 border-black bg-[#3BF4C7] px-3 py-2 text-sm font-bold text-black transition duration-150 group-hover:-translate-x-1 group-hover:-translate-y-1 disabled:cursor-not-allowed dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:group-hover:border-[#3BF4C7] dark:group-hover:text-[#3BF4C7] sm:px-4 sm:text-lg"
                >
                    {pending ? "Uploading..." : "Upload"}
                </button>
            </div>
        </div>
    );
}

function UploadTitleField({
    label,
    value,
    onChange,
    inputId,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    inputId?: string;
}) {
    return (
        <input
            id={inputId}
            type="text"
            aria-label={inputId ? undefined : label}
            className="w-full border border-black/30 bg-white px-3 py-2 text-sm text-black placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-[#5FC4E7] dark:border-[#D5D5D5]/40 dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:placeholder-[#D5D5D5]/30"
            value={value}
            maxLength={240}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Title (optional)"
        />
    );
}

function CourseField({
    courseId,
    courses,
    onChange,
    required = true,
}: {
    courseId: string | null;
    courses: CourseOption[];
    onChange: (courseId: string | null) => void;
    required?: boolean;
}) {
    return (
        <div>
            <p className={LABEL_CLASS}>
                Course{required ? (
                    <span className="text-red-500"> *</span>
                ) : (
                    <span className="font-normal normal-case tracking-normal"> · optional</span>
                )}
            </p>
            <CoursePicker
                courses={courses}
                value={courseId}
                onChange={onChange}
            />
        </div>
    );
}

function LabeledSelect({
    id,
    label,
    onChange,
    options,
    placeholder,
    value,
}: {
    id: string;
    label: string;
    onChange: (value: string) => void;
    options: ReadonlyArray<{ value: string; label: string }>;
    placeholder: string;
    value: string;
}) {
    return (
        <div>
            <label htmlFor={id} className={LABEL_CLASS}>
                {label}
            </label>
            <select
                id={id}
                className={SELECT_CLASS}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            >
                <option value="">{placeholder}</option>
                {options.map((item) => (
                    <option key={item.value} value={item.value}>
                        {item.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

const YEAR_OPTIONS = YEARS.map((value) => ({ value, label: value }));
const SLOT_SELECT_OPTIONS = SLOT_OPTIONS.map((value) => ({ value, label: value }));

function PastPaperMetadataFields({
    details,
    idPrefix,
    onChange,
}: {
    details: PaperDetails;
    idPrefix: string;
    onChange: <Field extends PaperDetailsField>(field: Field, value: PaperDetails[Field]) => void;
}) {
    return (
        <>
            <div className="grid grid-cols-2 gap-3">
                <LabeledSelect
                    id={`${idPrefix}-exam-type`}
                    label="Exam type"
                    placeholder="Select"
                    options={EXAM_TYPE_OPTIONS}
                    value={details.examType}
                    onChange={(value) => onChange("examType", value)}
                />
                <LabeledSelect
                    id={`${idPrefix}-slot`}
                    label="Slot"
                    placeholder="None"
                    options={SLOT_SELECT_OPTIONS}
                    value={details.slot}
                    onChange={(value) => onChange("slot", value)}
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <LabeledSelect
                    id={`${idPrefix}-year`}
                    label="Year"
                    placeholder="Select"
                    options={YEAR_OPTIONS}
                    value={details.year}
                    onChange={(value) => onChange("year", value)}
                />
                <LabeledSelect
                    id={`${idPrefix}-semester`}
                    label="Semester"
                    placeholder="Unknown"
                    options={SEMESTERS}
                    value={details.semesterVal}
                    onChange={(value) => onChange("semesterVal", value)}
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <LabeledSelect
                    id={`${idPrefix}-campus`}
                    label="Campus"
                    placeholder="Vellore"
                    options={CAMPUSES}
                    value={details.campusVal}
                    onChange={(value) => onChange("campusVal", value)}
                />
                <div className="flex items-end pb-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-black dark:text-[#D5D5D5]">
                        <input
                            type="checkbox"
                            checked={details.hasAnswerKey}
                            onChange={(event) => onChange("hasAnswerKey", event.target.checked)}
                            className="size-4 accent-[#5FC4E7]"
                        />
                        Has answer key
                    </label>
                </div>
            </div>
        </>
    );
}

function BasicMetadataFields({
    onChange,
    slot,
    year,
}: {
    onChange: (field: "year" | "slot", value: string) => void;
    slot: string;
    year: string;
}) {
    return (
        <div className="grid grid-cols-1 place-content-center gap-3 sm:grid-cols-2 sm:gap-4">
            <div>
                <select
                    aria-label="Year"
                    className="w-full cursor-pointer bg-[#5FC4E7] p-2 transition-colors duration-300 hover:bg-opacity-85 dark:bg-[#008A90]"
                    value={year}
                    onChange={(event) => onChange("year", event.target.value)}
                >
                    <option value="">Select Year</option>
                    {YEARS.map((item) => (
                        <option key={item} value={item}>
                            {item}
                        </option>
                    ))}
                </select>
            </div>
            <div>
                <select
                    aria-label="Slot"
                    className="w-full cursor-pointer bg-[#5FC4E7] p-2 transition-colors duration-300 hover:bg-opacity-85 dark:bg-[#008A90]"
                    value={slot}
                    onChange={(event) => onChange("slot", event.target.value)}
                >
                    <option value="">Slot</option>
                    {SLOT_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                            {item}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}

function UploadIcon() {
    return (
        <svg
            className="mb-2 size-8 text-gray-400 sm:size-10"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
        </svg>
    );
}

function PaperFileSection({
    label,
    onAddFiles,
    onClearSource,
    onMovePage,
    onRejectFiles,
    onRemovePage,
    onRotatePage,
    onScan,
    paper,
}: {
    label: string;
    onAddFiles: (files: File[]) => void;
    onClearSource: () => void;
    onMovePage: (pageId: string, delta: number) => void;
    onRejectFiles: (rejections: FileRejection[]) => void;
    onRemovePage: (pageId: string) => void;
    onRotatePage: (pageId: string) => void;
    onScan: () => void;
    paper: PaperDraft;
}) {
    const photoInputRef = useRef<HTMLInputElement | null>(null);
    const { source } = paper;
    const dropzone = useDropzone({
        onDrop: (accepted, rejected) => {
            if (rejected.length) onRejectFiles(rejected);
            if (accepted.length) onAddFiles(accepted);
        },
        noClick: true,
        noKeyboard: true,
        // Clipboard images are handled at the document level.
        noPaste: true,
        disabled: source.kind === "pdf",
        accept: source.kind === "photos" ? IMAGE_ACCEPT : PDF_OR_IMAGE_ACCEPT,
    });

    if (source.kind === "pdf") {
        return (
            <div className="flex items-center gap-3 border-y border-black/10 py-1 dark:border-white/10">
                <FontAwesomeIcon icon={faFilePdf} className="text-2xl text-[#5FC4E7] dark:text-[#3BF4C7]" />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{source.file.name}</p>
                    <p className="text-xs text-black/60 dark:text-[#D5D5D5]/60">
                        PDF · {formatMegabytes(source.file.size)}
                    </p>
                </div>
                <button
                    type="button"
                    className="flex size-10 shrink-0 items-center justify-center text-red-500"
                    onClick={onClearSource}
                    aria-label={`Remove ${source.file.name} from ${label.toLowerCase()}`}
                >
                    <FontAwesomeIcon icon={faCircleXmark} />
                </button>
            </div>
        );
    }

    const pages = getPaperPages(paper);
    const readyPages = pages.filter(isPageReady);
    const processingCount = pages.length - readyPages.length;
    const estimatedBytes = estimatePdfBytes(readyPages.map((page) => page.processed.blob.size));
    const pageSlots = remainingPageSlots(paper);

    const photoInput = (
        <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            aria-label={`Add photos to ${label.toLowerCase()}`}
            onChange={(event) => {
                if (event.target.files) onAddFiles(Array.from(event.target.files));
                event.target.value = "";
            }}
        />
    );

    if (source.kind === "none") {
        return (
            <div
                {...dropzone.getRootProps({
                    className: `flex min-h-[9rem] flex-col items-center justify-center border-2 border-dashed p-4 transition-all duration-300 ease-in-out sm:min-h-[11rem] ${
                        dropzone.isDragActive ? "border-[#5FC4E7] bg-[#5FC4E7]/10" : "border-gray-300"
                    }`,
                })}
            >
                <input {...dropzone.getInputProps({ "aria-label": `Choose a PDF or photos for ${label.toLowerCase()}` })} />
                <UploadIcon />
                <p className="text-center text-sm text-gray-500">Drop a PDF or photos here</p>
                <p className="mt-1 text-center text-xs text-gray-400">One PDF, or one photo per page</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={dropzone.open} className={SECONDARY_BUTTON_CLASS}>
                        <FontAwesomeIcon icon={faImages} />
                        Choose file
                    </button>
                    <button type="button" onClick={onScan} className={SECONDARY_BUTTON_CLASS}>
                        <FontAwesomeIcon icon={faCamera} />
                        Scan pages
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            {...dropzone.getRootProps({
                // Only an outline while photos are dragged over; the pages sit
                // directly on the paper card otherwise.
                className: `space-y-2 outline-2 outline-offset-4 transition-[outline-color] ${
                    dropzone.isDragActive ? "outline-dashed outline-[#5FC4E7]" : "outline-transparent"
                }`,
            })}
        >
            <input {...dropzone.getInputProps({ "aria-label": `Drop photos on ${label.toLowerCase()}` })} />
            <p className={LABEL_CLASS} aria-live="polite">
                Pages · {pages.length} ·{" "}
                <span className="normal-case tracking-normal">
                    {processingCount > 0
                        ? `processing ${readyPages.length + 1} of ${pages.length}...`
                        : `about ${formatMegabytes(estimatedBytes)}`}
                </span>
            </p>
            {processingCount > 0 ? (
                <div
                    role="progressbar"
                    aria-label={`Processing pages for ${label.toLowerCase()}`}
                    aria-valuemin={0}
                    aria-valuemax={pages.length}
                    aria-valuenow={readyPages.length}
                    className="h-1 w-full bg-black/10 dark:bg-white/10"
                >
                    <div
                        className="h-full bg-[#3BF4C7] transition-[width] duration-200"
                        style={{ width: `${(readyPages.length / pages.length) * 100}%` }}
                    />
                </div>
            ) : null}
            {processingCount === 0 && !fitsUploadLimit(estimatedBytes, MAX_UPLOAD_PDF_BYTES) ? (
                <p className="text-xs text-black/70 dark:text-[#D5D5D5]/70">
                    These pages are over 25 MB, so they will be compressed more when you upload.
                </p>
            ) : null}

            <PhotoPageGrid
                label={`Pages of ${label.toLowerCase()}`}
                pages={pages}
                onMove={onMovePage}
                onRemove={onRemovePage}
                onRotate={onRotatePage}
            />

            {photoInput}
            <div className="flex flex-wrap gap-2 pt-1">
                <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={pageSlots <= 0}
                    className={SECONDARY_BUTTON_CLASS}
                >
                    <FontAwesomeIcon icon={faImages} />
                    Add photos
                </button>
                <button
                    type="button"
                    onClick={onScan}
                    disabled={pageSlots <= 0}
                    className={SECONDARY_BUTTON_CLASS}
                >
                    <FontAwesomeIcon icon={faCamera} />
                    Scan more pages
                </button>
            </div>
        </div>
    );
}

function PaperCard({
    canRemove,
    courses,
    idPrefix,
    index,
    onAddFiles,
    onFieldChange,
    onRejectFiles,
    onRemove,
    onScan,
    onTitleChange,
    dispatch,
    paper,
}: {
    canRemove: boolean;
    courses?: CourseOption[];
    idPrefix: string;
    index: number;
    onAddFiles: (paperId: string, files: File[]) => void;
    onFieldChange: PaperFieldChange;
    onRejectFiles: (rejections: FileRejection[]) => void;
    onRemove: (paperId: string) => void;
    onScan: (paperId: string) => void;
    onTitleChange: (paperId: string, value: string) => void;
    dispatch: React.Dispatch<UploadFormAction>;
    paper: PaperDraft;
}) {
    const label = `Paper ${index + 1}`;
    const headingId = `${idPrefix}-heading`;
    const titleId = `${idPrefix}-title`;
    const paperId = paper.id;
    const changeField = <Field extends PaperDetailsField>(field: Field, value: PaperDetails[Field]) =>
        onFieldChange(paperId, field, value);

    return (
        <section
            id={idPrefix}
            aria-labelledby={headingId}
            className="scroll-mt-4 space-y-3 border-2 border-black p-3 dark:border-[#D5D5D5]/40 sm:space-y-4 sm:p-4"
        >
            <div className="flex items-center justify-between gap-2">
                <h4 id={headingId} className="text-sm font-bold uppercase tracking-wider">
                    {label}
                </h4>
                {canRemove ? (
                    <button
                        type="button"
                        onClick={() => onRemove(paperId)}
                        className="-my-2 -mr-2 inline-flex h-10 items-center gap-1.5 px-2 text-xs font-semibold text-red-600 hover:bg-red-500/10 dark:text-red-400"
                        aria-label={`Remove ${label.toLowerCase()}`}
                    >
                        <FontAwesomeIcon icon={faCircleXmark} />
                        Remove
                    </button>
                ) : null}
            </div>

            {courses?.length ? (
                <>
                    <CourseField
                        courseId={paper.details.courseId}
                        courses={courses}
                        required={false}
                        onChange={(value) => changeField("courseId", value)}
                    />
                    <PastPaperMetadataFields
                        details={paper.details}
                        idPrefix={idPrefix}
                        onChange={changeField}
                    />
                </>
            ) : (
                <BasicMetadataFields
                    slot={paper.details.slot}
                    year={paper.details.year}
                    onChange={(field, value) => changeField(field, value)}
                />
            )}

            <PaperFileSection
                label={label}
                paper={paper}
                onAddFiles={(files) => onAddFiles(paperId, files)}
                onClearSource={() => dispatch({ type: "clear_paper_source", paperId })}
                onMovePage={(pageId, delta) => dispatch({ type: "move_page", paperId, pageId, delta })}
                onRejectFiles={onRejectFiles}
                onRemovePage={(pageId) => dispatch({ type: "remove_page", paperId, pageId })}
                onRotatePage={(pageId) => dispatch({ type: "rotate_page", paperId, pageId })}
                onScan={() => onScan(paperId)}
            />

            <div>
                <label htmlFor={titleId} className={LABEL_CLASS}>
                    Title
                </label>
                <UploadTitleField
                    inputId={titleId}
                    label={`${label} title`}
                    value={paper.title}
                    onChange={(value) => onTitleChange(paperId, value)}
                />
            </div>
        </section>
    );
}

function NotesDropzone({
    canAddMore,
    count,
    onAddFiles,
    onRejectFiles,
}: {
    canAddMore: boolean;
    count: number;
    onAddFiles: (files: File[]) => void;
    onRejectFiles: (rejections: FileRejection[]) => void;
}) {
    const dropzone = useDropzone({
        onDrop: (accepted, rejected) => {
            if (rejected.length) onRejectFiles(rejected);
            if (accepted.length) onAddFiles(accepted);
        },
        noPaste: true,
        multiple: true,
        disabled: !canAddMore,
        accept: PDF_ACCEPT,
    });

    return (
        <div
            {...dropzone.getRootProps({
                className: `flex min-h-[10rem] flex-col items-center justify-center border-2 border-dashed p-4 transition-all duration-300 ease-in-out sm:min-h-[12rem] sm:p-6 md:p-8 ${
                    dropzone.isDragActive ? "border-[#5FC4E7] bg-[#5FC4E7]/10" : "border-gray-300"
                } ${canAddMore ? "cursor-pointer" : "cursor-default"}`,
            })}
        >
            <input {...dropzone.getInputProps({ "aria-label": "Select notes files" })} />
            <UploadIcon />
            {count === 0 ? (
                <>
                    <p className="text-center text-sm text-gray-500">Drop a PDF here</p>
                    <p className="mt-1 text-center text-xs text-gray-400">or click to browse</p>
                </>
            ) : (
                <p className="text-center text-sm text-gray-500">
                    {count} PDF{count === 1 ? "" : "s"} selected
                    {canAddMore ? "" : ` (up to ${MAX_FILES_PER_UPLOAD})`}
                </p>
            )}
        </div>
    );
}

function SelectedNotesList({
    notes,
    onRemove,
    onTitleChange,
}: {
    notes: NoteDraft[];
    onRemove: (noteId: string) => void;
    onTitleChange: (noteId: string, value: string) => void;
}) {
    if (notes.length === 0) return null;

    return (
        <div className="w-full space-y-2">
            {notes.map((note, index) => (
                <div key={note.id} className="flex w-full items-center gap-2">
                    <UploadTitleField
                        label={`Title ${index + 1}`}
                        value={note.title}
                        onChange={(value) => onTitleChange(note.id, value)}
                    />
                    <button
                        type="button"
                        className="flex size-10 shrink-0 items-center justify-center text-red-500"
                        onClick={() => onRemove(note.id)}
                        aria-label={`Remove ${note.file.name}`}
                    >
                        <FontAwesomeIcon icon={faCircleXmark} />
                    </button>
                </div>
            ))}
        </div>
    );
}

function reviewToast(variant: UploadVariant, count: number, autoReview: boolean) {
    const subject = variant === "Past Papers"
        ? count === 1 ? "Paper" : `${count} papers`
        : count === 1 ? "Notes" : `${count} notes`;
    return `${subject} submitted for ${autoReview ? "AI" : "moderator"} review.`;
}

function useUploadFileController({ variant, courses }: UploadFileProps) {
    const fieldId = useId();
    const nextIdRef = useRef(0);
    const newId = useCallback(
        (kind: string) => `${kind}-${++nextIdRef.current}`,
        [],
    );
    const [state, dispatch] = useReducer(
        uploadFormReducer,
        "paper-0",
        createInitialUploadFormState,
    );
    const [pending, startTransition] = useTransition();
    const [submitStatus, setSubmitStatus] = useState("");
    const [scanPaperId, setScanPaperId] = useState<string | null>(null);
    const submissionInFlightRef = useRef(false);
    // Pages are processed one at a time, in the order they were added.
    const processingQueueRef = useRef<Promise<void>>(Promise.resolve());
    // Pages removed before their turn are skipped rather than decoded.
    const cancelledPageIdsRef = useRef(new Set<string>());
    const mountedRef = useRef(true);
    const scrollToPaperRef = useRef<string | null>(null);
    const stateRef = useRef(state);

    const { toast } = useToast();
    const { push } = useRouter();
    const { requireAuth } = useGuestPrompt();

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        const paperId = scrollToPaperRef.current;
        if (!paperId || !state.papers.some((paper) => paper.id === paperId)) return;
        scrollToPaperRef.current = null;
        document.getElementById(`${fieldId}-${paperId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [fieldId, state.papers]);

    const setError = useCallback((error: string) => {
        dispatch({ type: "set_error", error });
    }, []);

    const blockedWhileUploading = useCallback(() => {
        if (!submissionInFlightRef.current) return false;
        toast({ title: "Wait for the current upload to finish." });
        return true;
    }, [toast]);

    const rejectFiles = useCallback((rejections: FileRejection[]) => {
        const heic = rejections.find(({ file }) => isHeicLike(file));
        toast({
            title: heic ? unreadablePhotoMessage(heic.file) : "Unsupported file type",
            variant: "destructive",
        });
    }, [toast]);

    const enqueuePages = useCallback((paperId: string, pages: NewPage[]) => {
        for (const page of pages) {
            processingQueueRef.current = processingQueueRef.current.then(async () => {
                if (!mountedRef.current || cancelledPageIdsRef.current.has(page.id)) return;
                try {
                    const processed = await processPhotoPage(page.source);
                    dispatch({ type: "page_processed", paperId, pageId: page.id, processed });
                } catch (error) {
                    if (!(error instanceof UnreadablePhotoError)) {
                        console.error("Failed to process photo:", error);
                    }
                    dispatch({ type: "page_failed", paperId, pageId: page.id });
                    if (mountedRef.current) {
                        toast({
                            title: unreadablePhotoMessage({
                                name: page.name,
                                type: page.source.type,
                            }),
                            variant: "destructive",
                        });
                    }
                }
            });
        }
    }, [toast]);

    const addPhotos = useCallback((paperId: string, files: File[]) => {
        const paper = stateRef.current.papers.find((item) => item.id === paperId);
        if (!paper || files.length === 0) return;
        if (paper.source.kind === "pdf") {
            toast({ title: "Remove the PDF before adding photos", variant: "destructive" });
            return;
        }
        const slots = remainingPageSlots(paper);
        if (slots <= 0) {
            toast({ title: `A paper can have up to ${MAX_PAGES_PER_PAPER} pages.`, variant: "destructive" });
            return;
        }
        if (files.length > slots) {
            toast({ title: `Only the first ${slots} photos were added. A paper can have up to ${MAX_PAGES_PER_PAPER} pages.` });
        }
        const pages = files.slice(0, slots).map((file) => ({
            id: newId("page"),
            name: file.name || "photo.jpg",
            source: file,
        }));
        dispatch({ type: "add_pages", paperId, pages });
        // Keep the ref current for a second add in the same tick.
        stateRef.current = uploadFormReducer(stateRef.current, { type: "add_pages", paperId, pages });
        enqueuePages(paperId, pages);
    }, [enqueuePages, newId, toast]);

    const addFilesToPaper = useCallback((paperId: string, incomingFiles: File[]) => {
        if (!incomingFiles.length || blockedWhileUploading()) return;
        const paper = stateRef.current.papers.find((item) => item.id === paperId);
        if (!paper) return;

        const pdfFiles = incomingFiles.filter(isPdfFile);
        const imageFiles = incomingFiles.filter((file) => !isPdfFile(file) && isImageFile(file));
        if (pdfFiles.length + imageFiles.length < incomingFiles.length) {
            toast({ title: "Unsupported file type", variant: "destructive" });
        }
        if (pdfFiles.length && imageFiles.length) {
            toast({ title: "Drop photos or PDFs — not both at once", variant: "destructive" });
            return;
        }
        if (imageFiles.length) {
            addPhotos(paperId, imageFiles);
            return;
        }
        if (!pdfFiles.length) return;
        if (paper.source.kind !== "none") {
            toast({ title: "Remove this paper's pages before adding a PDF", variant: "destructive" });
            return;
        }
        const slots = remainingPaperSlots(stateRef.current, paperId);
        if (pdfFiles.length > slots) {
            toast({
                title: `Up to ${MAX_FILES_PER_UPLOAD} papers per upload`,
                description: "Upload the rest in another batch.",
                variant: "destructive",
            });
        }
        const pdfs = pdfFiles.slice(0, slots).map((file) => ({
            id: newId("paper"),
            file,
            title: stripExtension(file.name),
        }));
        if (pdfs.length === 0) return;
        const action: UploadFormAction = { type: "attach_pdfs", paperId, pdfs };
        dispatch(action);
        stateRef.current = uploadFormReducer(stateRef.current, action);
    }, [addPhotos, blockedWhileUploading, newId, toast]);

    const addPaper = useCallback(() => {
        if (blockedWhileUploading()) return;
        if (stateRef.current.papers.length >= MAX_FILES_PER_UPLOAD) return;
        const paperId = newId("paper");
        scrollToPaperRef.current = paperId;
        dispatch({ type: "add_paper", paperId });
    }, [blockedWhileUploading, newId]);

    const removePaper = useCallback((paperId: string) => {
        const paper = stateRef.current.papers.find((item) => item.id === paperId);
        if (paper) {
            getPaperPages(paper).forEach((page) => cancelledPageIdsRef.current.add(page.id));
        }
        dispatch({ type: "remove_paper", paperId, replacementId: newId("paper") });
    }, [newId]);

    const paperDispatch = useCallback((action: UploadFormAction) => {
        if (action.type === "remove_page") cancelledPageIdsRef.current.add(action.pageId);
        dispatch(action);
    }, []);

    const updatePaperField = useCallback<PaperFieldChange>((paperId, field, value) => {
        dispatch({ type: "set_paper_field", paperId, field, value } as UploadFormAction);
    }, []);

    const updatePaperTitle = useCallback((paperId: string, value: string) => {
        dispatch({ type: "set_paper_title", paperId, value });
    }, []);

    const updateNoteField = useCallback<NoteFieldChange>((field, value) => {
        dispatch({ type: "set_note_field", field, value } as UploadFormAction);
    }, []);

    const addNotes = useCallback((incomingFiles: File[]) => {
        if (!incomingFiles.length || blockedWhileUploading()) return;
        const pdfFiles = incomingFiles.filter(isPdfFile);
        if (pdfFiles.length < incomingFiles.length) {
            toast({ title: "Unsupported file type", variant: "destructive" });
        }
        const slots = MAX_FILES_PER_UPLOAD - stateRef.current.notes.length;
        if (pdfFiles.length > slots) {
            toast({ title: `Up to ${MAX_FILES_PER_UPLOAD} PDFs per upload`, variant: "destructive" });
        }
        const notes = pdfFiles.slice(0, Math.max(0, slots)).map((file) => ({
            id: newId("note"),
            file,
            title: stripExtension(file.name),
        }));
        if (notes.length === 0) return;
        const action: UploadFormAction = { type: "add_notes", notes };
        dispatch(action);
        stateRef.current = uploadFormReducer(stateRef.current, action);
    }, [blockedWhileUploading, newId, toast]);

    const openScanner = useCallback((paperId: string) => {
        if (blockedWhileUploading()) return;
        setScanPaperId(paperId);
    }, [blockedWhileUploading]);

    const finishScan = useCallback((files: File[]) => {
        const paperId = scanPaperId;
        setScanPaperId(null);
        if (paperId && !blockedWhileUploading()) addPhotos(paperId, files);
    }, [addPhotos, blockedWhileUploading, scanPaperId]);

    const cancelScan = useCallback(() => setScanPaperId(null), []);

    useEffect(() => {
        if (variant !== "Past Papers") return;

        const handleClipboardPaste = (event: ClipboardEvent) => {
            const pastedImages = getClipboardImageFiles(event.clipboardData);
            if (pastedImages.length === 0) return;

            event.preventDefault();
            // Paste into the last paper that can take photos.
            const target = [...stateRef.current.papers]
                .reverse()
                .find((paper) => paper.source.kind !== "pdf");
            if (!target) {
                toast({ title: "Add another paper for these photos", variant: "destructive" });
                return;
            }
            addFilesToPaper(target.id, pastedImages);
        };

        document.addEventListener("paste", handleClipboardPaste);
        return () => document.removeEventListener("paste", handleClipboardPaste);
    }, [addFilesToPaper, toast, variant]);

    const submitPapers = useCallback(async (papers: PaperDraft[]) => {
        const files: Array<{ file: File; title: string }> = [];
        for (const [index, paper] of papers.entries()) {
            const title = getPaperTitle(paper, index);
            const label = papers.length > 1 ? `Paper ${index + 1}` : "The paper";
            if (paper.source.kind === "pdf") {
                if (paper.source.file.size > MAX_UPLOAD_PDF_BYTES) {
                    throw new Error(`${label}'s PDF is over 25 MB. Compress it or split it into smaller PDFs.`);
                }
                files.push({ file: paper.source.file, title });
                continue;
            }
            setSubmitStatus(papers.length > 1
                ? `Preparing paper ${index + 1} of ${papers.length}...`
                : "Preparing pages...");
            const pages = getPaperPages(paper).filter(isPageReady);
            const built = await buildPhotoPdf(
                pages.map((page) => ({ source: page.source, image: page.processed, rotation: page.rotation })),
                pdfFileName(title),
            );
            if (!built.ok) {
                throw new Error(
                    `${label} is too large (${formatMegabytes(built.bytes)} after compressing; the limit is 25 MB). Split it into two papers or remove some pages.`,
                );
            }
            files.push({ file: built.file, title });
        }

        setSubmitStatus(papers.length > 1 ? `Uploading ${papers.length} papers...` : "Uploading...");
        const receiptIds = await mapWithConcurrency(files, PROCESS_CONCURRENCY, ({ file, title }) =>
            processUpload(file, title),
        );
        return buildPastPaperSaveBody(papers, receiptIds);
    }, []);

    const submitNotes = useCallback(async (notes: NoteDraft[], noteDetails: NoteDetails) => {
        setSubmitStatus("Uploading...");
        const receiptIds = await mapWithConcurrency(notes, PROCESS_CONCURRENCY, (note) =>
            processUpload(note.file, note.title.trim() || stripExtension(note.file.name)),
        );
        return buildNotesSaveBody(noteDetails, receiptIds);
    }, []);

    const handleSubmit = useCallback(
        async (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (submissionInFlightRef.current) return;

            if (!requireAuth(`upload ${variant.toLowerCase()}`)) {
                return;
            }

            setError("");
            const { papers, notes, noteDetails } = stateRef.current;

            if (variant === "Past Papers") {
                if (isProcessingPages(stateRef.current)) {
                    setError("Wait for the pages to finish processing before uploading.");
                    return;
                }
                const problems = getPaperProblems(papers);
                if (problems.length) {
                    setError(problems.join(" "));
                    return;
                }
            } else {
                if (notes.length === 0) {
                    setError("Please select at least one file to upload.");
                    return;
                }
                if (courses?.length && !noteDetails.courseId) {
                    setError("Please select a course.");
                    return;
                }
            }

            submissionInFlightRef.current = true;
            startTransition(async () => {
                try {
                    const body = variant === "Past Papers"
                        ? await submitPapers(papers)
                        : await submitNotes(notes, noteDetails);
                    setSubmitStatus("Saving...");

                    const saveResponse = await fetch("/api/uploads", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(body),
                    });
                    const savePayload = (await saveResponse
                        .json()
                        .catch(() => null)) as UploadSaveResponse | null;

                    if (!saveResponse.ok || !savePayload?.success) {
                        throw new Error(
                            savePayload?.error ?? "Failed to save upload metadata.",
                        );
                    }

                    toast({
                        title: reviewToast(variant, body.results.length, savePayload.autoReview === true),
                    });
                    push(variant === "Past Papers" ? "/past_papers" : "/notes");
                } catch (uploadError) {
                    console.error("Error uploading files:", uploadError);
                    setError(`Error uploading files: ${
                        uploadError instanceof Error
                            ? uploadError.message
                            : "Unknown error"
                    }`);
                } finally {
                    submissionInFlightRef.current = false;
                    setSubmitStatus("");
                }
            });
        },
        [
            courses?.length,
            push,
            requireAuth,
            setError,
            submitNotes,
            submitPapers,
            toast,
            variant,
        ],
    );

    return {
        addFilesToPaper,
        addNotes,
        addPaper,
        cancelScan,
        dispatch: paperDispatch,
        fieldId,
        finishScan,
        handleSubmit,
        isProcessing: isProcessingPages(state),
        openScanner,
        pending,
        rejectFiles,
        removePaper,
        scanPaperId,
        state,
        submitStatus,
        updateNoteField,
        updatePaperField,
        updatePaperTitle,
    };
}

function UploadFile({ variant, courses }: UploadFileProps) {
    const {
        addFilesToPaper,
        addNotes,
        addPaper,
        cancelScan,
        dispatch,
        fieldId,
        finishScan,
        handleSubmit,
        isProcessing,
        openScanner,
        pending,
        rejectFiles,
        removePaper,
        scanPaperId,
        state,
        submitStatus,
        updateNoteField,
        updatePaperField,
        updatePaperTitle,
    } = useUploadFileController({ variant, courses });

    const { error, noteDetails, notes, papers } = state;
    const formId = `${fieldId}-form`;
    const hasCourseSelection = Boolean(courses?.length);
    const scanPaper = papers.find((paper) => paper.id === scanPaperId);
    const canAddPaper = papers.length < MAX_FILES_PER_UPLOAD;

    return (
        <div className="flex min-h-screen items-start justify-center px-3 py-4 sm:items-center sm:p-6">
            <div className={`w-full border-2 border-dashed border-[#D5D5D5] bg-white p-3 text-black shadow-lg dark:bg-[#0C1222] dark:text-[#D5D5D5] sm:p-6 ${variant === "Past Papers" ? "max-w-xl" : "max-w-md"}`}>
                <UploadHeader
                    formId={formId}
                    pending={pending}
                    disabled={pending || isProcessing}
                    variant={variant}
                />

                <form
                    id={formId}
                    onSubmit={handleSubmit}
                    className="w-full"
                >
                    {/* The submitted values are read when the upload starts, so lock the fields until it ends. */}
                    <fieldset disabled={pending} className="m-0 min-w-0 space-y-4 border-0 p-0">
                        {variant === "Past Papers" ? (
                            <>
                                {papers.map((paper, index) => (
                                    <PaperCard
                                        key={paper.id}
                                        canRemove={papers.length > 1 || paper.source.kind !== "none"}
                                        courses={courses}
                                        dispatch={dispatch}
                                        idPrefix={`${fieldId}-${paper.id}`}
                                        index={index}
                                        onAddFiles={addFilesToPaper}
                                        onFieldChange={updatePaperField}
                                        onRejectFiles={rejectFiles}
                                        onRemove={removePaper}
                                        onScan={openScanner}
                                        onTitleChange={updatePaperTitle}
                                        paper={paper}
                                    />
                                ))}
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <button
                                        type="button"
                                        onClick={addPaper}
                                        disabled={!canAddPaper}
                                        className={SECONDARY_BUTTON_CLASS}
                                    >
                                        <FontAwesomeIcon icon={faPlus} />
                                        Add another paper
                                    </button>
                                    <p className="text-xs text-black/60 dark:text-[#D5D5D5]/60">
                                        {canAddPaper
                                            ? `Copies paper ${papers.length}'s details · up to ${MAX_FILES_PER_UPLOAD} papers`
                                            : `Up to ${MAX_FILES_PER_UPLOAD} papers per upload.`}
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                {hasCourseSelection && courses ? (
                                    <CourseField
                                        courseId={noteDetails.courseId}
                                        courses={courses}
                                        onChange={(value) => updateNoteField("courseId", value)}
                                    />
                                ) : (
                                    <BasicMetadataFields
                                        slot={noteDetails.slot}
                                        year={noteDetails.year}
                                        onChange={(field, value) => updateNoteField(field, value)}
                                    />
                                )}
                                <NotesDropzone
                                    canAddMore={notes.length < MAX_FILES_PER_UPLOAD}
                                    count={notes.length}
                                    onAddFiles={addNotes}
                                    onRejectFiles={rejectFiles}
                                />
                                <SelectedNotesList
                                    notes={notes}
                                    onRemove={(noteId) => dispatch({ type: "remove_note", noteId })}
                                    onTitleChange={(noteId, value) => dispatch({ type: "set_note_title", noteId, value })}
                                />
                            </>
                        )}

                        <p className="text-center text-sm text-black/70 empty:hidden dark:text-[#D5D5D5]/70" aria-live="polite">
                            {submitStatus}
                        </p>

                        {error ? (
                            <div className="mb-4 text-center" role="alert">
                                <span className="text-red-500">{error}</span>
                            </div>
                        ) : null}
                    </fieldset>
                </form>
            </div>

            {scanPaper ? (
                <ScanPagesDialog
                    maxPages={remainingPageSlots(scanPaper)}
                    onCancel={cancelScan}
                    onDone={finishScan}
                />
            ) : null}
        </div>
    );
}

export default UploadFile;
