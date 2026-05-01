"use client";

import React, {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useReducer,
    useRef,
    useTransition,
} from "react";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faCircleXmark } from "@fortawesome/free-solid-svg-icons";
import { useToast } from "@/app/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useGuestPrompt } from "@/app/components/guest-prompt-provider";
import CoursePicker, { type CourseOption } from "@/app/components/mod/course-picker";
import AppImage from "@/app/components/common/app-image";

type UploadVariant = "Notes" | "Past Papers";

type UploadFileProps = {
    variant: UploadVariant;
    courses?: CourseOption[];
};

type ProcessedUploadResult = {
    fileUrl: string;
    thumbnailUrl: string | null;
    filename: string;
    message: string;
};

type UploadSaveResponse = {
    success: boolean;
    error?: string;
};

type UploadFormState = {
    fileTitles: string[];
    year: string;
    slot: string;
    courseId: string | null;
    examType: string;
    semesterVal: string;
    campusVal: string;
    hasAnswerKey: boolean;
    files: File[];
    isDragging: boolean;
    error: string;
    isConverting: boolean;
    imageBundleFiles: File[];
    isImageBundleMode: boolean;
};

type UploadFormAction =
    | { type: "patch"; payload: Partial<UploadFormState> }
    | { type: "update_title"; index: number; value: string };

type UploadFieldChange = (
    field: keyof UploadFormState,
    value: UploadFormState[keyof UploadFormState],
) => void;

type UploadFieldIds = {
    formId: string;
    examTypeId: string;
    slotId: string;
    yearId: string;
    semesterId: string;
    campusId: string;
    bundleTitleId: string;
    addMoreImagesId: string;
};

type DropzoneBindings = Pick<
    ReturnType<typeof useDropzone>,
    "getRootProps" | "getInputProps"
>;

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

const EXAM_TYPES = [
    { value: "CAT_1", label: "CAT-1" },
    { value: "CAT_2", label: "CAT-2" },
    { value: "FAT", label: "FAT" },
    { value: "MODEL_CAT_1", label: "Model CAT-1" },
    { value: "MODEL_CAT_2", label: "Model CAT-2" },
    { value: "MODEL_FAT", label: "Model FAT" },
    { value: "MID", label: "Mid" },
    { value: "QUIZ", label: "Quiz" },
    { value: "CIA", label: "CIA" },
    { value: "OTHER", label: "Other" },
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

const initialUploadFormState: UploadFormState = {
    fileTitles: [],
    year: "",
    slot: "",
    courseId: null,
    examType: "",
    semesterVal: "",
    campusVal: "",
    hasAnswerKey: false,
    files: [],
    isDragging: false,
    error: "",
    isConverting: false,
    imageBundleFiles: [],
    isImageBundleMode: false,
};

const isPdfFile = (file: File) =>
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
const isImageFile = (file: File) => file.type.startsWith("image/");
const stripExtension = (filename: string) => filename.replace(/\.[^/.]+$/, "");
const PROCESSOR_SUCCESS_MESSAGE = "processed successfully";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function getStringField(
    source: Record<string, unknown>,
    ...keys: string[]
): string | null {
    for (const key of keys) {
        const value = source[key];
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }

    return null;
}

function normalizeProcessedUploadResult(
    payload: unknown,
    fallbackFilename: string,
): ProcessedUploadResult {
    if (!isRecord(payload)) {
        return {
            fileUrl: "",
            thumbnailUrl: null,
            filename: fallbackFilename,
            message: "Upload processor returned an invalid response.",
        };
    }

    const fileUrl = getStringField(payload, "fileUrl", "file_url", "url") ?? "";
    const filename =
        getStringField(payload, "filename", "fileName", "name") ?? fallbackFilename;
    const message =
        getStringField(payload, "message") ??
        (fileUrl
            ? PROCESSOR_SUCCESS_MESSAGE
            : "Upload processor did not return a file URL.");

    return {
        fileUrl,
        filename,
        message,
        thumbnailUrl: getStringField(
            payload,
            "thumbnailUrl",
            "thumbnail_url",
            "thumbNailUrl",
        ),
    };
}

function uploadFormReducer(
    state: UploadFormState,
    action: UploadFormAction,
): UploadFormState {
    switch (action.type) {
        case "patch":
            return { ...state, ...action.payload };
        case "update_title": {
            const nextTitles = [...state.fileTitles];
            nextTitles[action.index] = action.value;
            return { ...state, fileTitles: nextTitles };
        }
        default:
            return state;
    }
}

function UploadHeader({
    formId,
    pending,
    variant,
}: {
    formId: string;
    pending: boolean;
    variant: UploadVariant;
}) {
    const href = variant === "Past Papers" ? "/past_papers" : "/notes";

    return (
        <div className="mb-4 grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-4">
            <Link
                href={href}
                className="flex h-10 w-10 items-center justify-center border-2 border-[#3BF3C7] font-bold text-[#3BF3C7] hover:bg-[#ffffff]/10"
                aria-label={`Back to ${variant === "Past Papers" ? "past papers" : "notes"}`}
            >
                <FontAwesomeIcon icon={faArrowLeft} />
            </Link>
            <h3 className="truncate text-center text-base font-semibold sm:text-xl">
                New {variant}
            </h3>
            <div className="group relative">
                <div className="absolute inset-0 bg-black dark:bg-[#3BF4C7]" />
                <div className="duration-1000 transition dark:absolute dark:inset-0 dark:blur-[75px] dark:lg:bg-none dark:group-hover:duration-200 lg:dark:group-hover:bg-[#3BF4C7]" />
                <button
                    type="submit"
                    form={formId}
                    disabled={pending}
                    className="relative whitespace-nowrap border-2 border-black bg-[#3BF4C7] px-3 py-2 text-sm font-bold text-black transition duration-150 group-hover:-translate-x-1 group-hover:-translate-y-1 disabled:cursor-not-allowed dark:border-[#D5D5D5] dark:bg-[#0C1222] dark:text-[#D5D5D5] dark:group-hover:border-[#3BF4C7] dark:group-hover:text-[#3BF4C7] sm:px-4 sm:text-lg"
                >
                    {pending ? "Uploading..." : "Upload"}
                </button>
            </div>
        </div>
    );
}

function UploadTitleField({
    value,
    onChange,
    index,
    inputId,
}: {
    value: string;
    onChange: (index: number, value: string) => void;
    index: number;
    inputId?: string;
}) {
    return (
        <input
            id={inputId}
            type="text"
            className="w-full border-2 border-dashed border-gray-300 p-2 text-sm font-bold text-black dark:bg-[#0C1222] dark:text-[#D5D5D5] sm:text-base"
            value={value}
            onChange={(event) => onChange(index, event.target.value)}
            required
        />
    );
}

function CourseField({
    courseId,
    courses,
    updateField,
}: {
    courseId: string | null;
    courses: CourseOption[];
    updateField: UploadFieldChange;
}) {
    return (
        <div>
            <p className="mb-1 block text-xs font-semibold uppercase tracking-wider text-black/60 dark:text-[#D5D5D5]/60">
                Course <span className="text-red-500">*</span>
            </p>
            <CoursePicker
                courses={courses}
                value={courseId}
                onChange={(value) => updateField("courseId", value)}
            />
        </div>
    );
}

function PastPaperMetadataFields({
    campusVal,
    examType,
    hasAnswerKey,
    ids,
    semesterVal,
    slot,
    updateField,
    year,
}: {
    campusVal: string;
    examType: string;
    hasAnswerKey: boolean;
    ids: UploadFieldIds;
    semesterVal: string;
    slot: string;
    updateField: UploadFieldChange;
    year: string;
}) {
    return (
        <>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label
                        htmlFor={ids.examTypeId}
                        className="mb-1 block text-xs font-semibold uppercase tracking-wider text-black/60 dark:text-[#D5D5D5]/60"
                    >
                        Exam type <span className="text-red-500">*</span>
                    </label>
                    <select
                        id={ids.examTypeId}
                        className={SELECT_CLASS}
                        value={examType}
                        onChange={(event) => updateField("examType", event.target.value)}
                    >
                        <option value="">Select</option>
                        {EXAM_TYPES.map((item) => (
                            <option key={item.value} value={item.value}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label
                        htmlFor={ids.slotId}
                        className="mb-1 block text-xs font-semibold uppercase tracking-wider text-black/60 dark:text-[#D5D5D5]/60"
                    >
                        Slot
                    </label>
                    <select
                        id={ids.slotId}
                        className={SELECT_CLASS}
                        value={slot}
                        onChange={(event) => updateField("slot", event.target.value)}
                    >
                        <option value="">None</option>
                        {SLOT_OPTIONS.map((item) => (
                            <option key={item} value={item}>
                                {item}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label
                        htmlFor={ids.yearId}
                        className="mb-1 block text-xs font-semibold uppercase tracking-wider text-black/60 dark:text-[#D5D5D5]/60"
                    >
                        Year <span className="text-red-500">*</span>
                    </label>
                    <select
                        id={ids.yearId}
                        className={SELECT_CLASS}
                        value={year}
                        onChange={(event) => updateField("year", event.target.value)}
                    >
                        <option value="">Select</option>
                        {YEARS.map((item) => (
                            <option key={item} value={item}>
                                {item}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label
                        htmlFor={ids.semesterId}
                        className="mb-1 block text-xs font-semibold uppercase tracking-wider text-black/60 dark:text-[#D5D5D5]/60"
                    >
                        Semester
                    </label>
                    <select
                        id={ids.semesterId}
                        className={SELECT_CLASS}
                        value={semesterVal}
                        onChange={(event) => updateField("semesterVal", event.target.value)}
                    >
                        <option value="">Unknown</option>
                        {SEMESTERS.map((item) => (
                            <option key={item.value} value={item.value}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label
                        htmlFor={ids.campusId}
                        className="mb-1 block text-xs font-semibold uppercase tracking-wider text-black/60 dark:text-[#D5D5D5]/60"
                    >
                        Campus
                    </label>
                    <select
                        id={ids.campusId}
                        className={SELECT_CLASS}
                        value={campusVal}
                        onChange={(event) => updateField("campusVal", event.target.value)}
                    >
                        <option value="">Vellore</option>
                        {CAMPUSES.map((item) => (
                            <option key={item.value} value={item.value}>
                                {item.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex items-end pb-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-black dark:text-[#D5D5D5]">
                        <input
                            type="checkbox"
                            checked={hasAnswerKey}
                            onChange={(event) =>
                                updateField("hasAnswerKey", event.target.checked)
                            }
                            className="h-4 w-4 accent-[#5FC4E7]"
                        />
                        Has answer key
                    </label>
                </div>
            </div>
        </>
    );
}

function BasicMetadataFields({
    slot,
    updateField,
    year,
}: {
    slot: string;
    updateField: UploadFieldChange;
    year: string;
}) {
    return (
        <div className="grid grid-cols-1 place-content-center gap-3 sm:grid-cols-2 sm:gap-4">
            <div>
                <select
                    className="w-full cursor-pointer bg-[#5FC4E7] p-2 transition-colors duration-300 hover:bg-opacity-85 dark:bg-[#008A90]"
                    value={year}
                    onChange={(event) => updateField("year", event.target.value)}
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
                    className="w-full cursor-pointer bg-[#5FC4E7] p-2 transition-colors duration-300 hover:bg-opacity-85 dark:bg-[#008A90]"
                    value={slot}
                    onChange={(event) => updateField("slot", event.target.value)}
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

function ImageBundleSection({
    addMoreImagesId,
    bundleTitleId,
    cameraInputRef,
    imageBundleFiles,
    imagePreviewUrls,
    isConverting,
    onAddFiles,
    onRemoveAll,
    onTitleChange,
    title,
}: {
    addMoreImagesId: string;
    bundleTitleId: string;
    cameraInputRef: React.RefObject<HTMLInputElement | null>;
    imageBundleFiles: File[];
    imagePreviewUrls: Array<{ key: string; url: string }>;
    isConverting: boolean;
    onAddFiles: (files: File[]) => Promise<void>;
    onRemoveAll: () => void;
    onTitleChange: (index: number, value: string) => void;
    title: string;
}) {
    return (
        <div className="space-y-3 border-2 border-[#5FC4E7] bg-[#5FC4E7]/10 p-4 dark:border-[#3BF4C7]/40 dark:bg-[#3BF4C7]/5">
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-black dark:text-[#D5D5D5]">
                    {imageBundleFiles.length} image
                    {imageBundleFiles.length !== 1 ? "s" : ""} selected
                </p>
                <button
                    type="button"
                    onClick={onRemoveAll}
                    className="shrink-0 text-red-500"
                    aria-label="Remove all"
                >
                    <FontAwesomeIcon icon={faCircleXmark} />
                </button>
            </div>

            <div className="flex flex-wrap gap-2">
                {imagePreviewUrls.map((preview, index) => (
                    <AppImage
                        key={preview.key}
                        src={preview.url}
                        alt={`Page ${index + 1}`}
                        width={64}
                        height={64}
                        className="h-16 w-auto border border-black/20 object-cover dark:border-white/20"
                    />
                ))}
            </div>

            {isConverting ? (
                <p className="text-xs text-black/50 dark:text-[#D5D5D5]/50">
                    Processing...
                </p>
            ) : null}

            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(event) => {
                    if (!event.target.files) return;
                    void onAddFiles(Array.from(event.target.files));
                    event.target.value = "";
                }}
            />
            <input
                id={addMoreImagesId}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                    if (!event.target.files) return;
                    void onAddFiles(Array.from(event.target.files));
                    event.target.value = "";
                }}
            />

            <div className="flex flex-wrap gap-2">
                <label
                    htmlFor={addMoreImagesId}
                    className="inline-flex h-8 cursor-pointer items-center border border-black/30 px-3 text-xs font-semibold hover:bg-black/5 dark:border-[#D5D5D5]/30 dark:hover:bg-white/5"
                >
                    Add more pages
                </label>
                <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="inline-flex h-8 items-center border border-black/30 px-3 text-xs font-semibold hover:bg-black/5 dark:border-[#D5D5D5]/30 dark:hover:bg-white/5"
                >
                    Use camera
                </button>
            </div>

            <div>
                <label
                    htmlFor={bundleTitleId}
                    className="mb-1 block text-xs font-semibold uppercase tracking-wider text-black/60 dark:text-[#D5D5D5]/60"
                >
                    Title
                </label>
                <UploadTitleField
                    value={title}
                    onChange={onTitleChange}
                    index={0}
                    inputId={bundleTitleId}
                />
            </div>
        </div>
    );
}

function PdfDropzoneSection({
    cameraInputRef,
    canSelectMoreFiles,
    dropzone,
    files,
    isDragging,
    onAddFiles,
    variant,
}: {
    cameraInputRef: React.RefObject<HTMLInputElement | null>;
    canSelectMoreFiles: boolean;
    dropzone: DropzoneBindings;
    files: File[];
    isDragging: boolean;
    onAddFiles: (files: File[]) => Promise<void>;
    variant: UploadVariant;
}) {
    return (
        <div
            {...dropzone.getRootProps({
                className: `
                    border-2 border-dashed
                    ${isDragging ? "border-[#5FC4E7] bg-[#5FC4E7]/10" : "border-gray-300"}
                    transition-all duration-300 ease-in-out
                    flex flex-col items-center justify-center
                    p-4 sm:p-6 md:p-8
                    min-h-[10rem] sm:min-h-[12rem]
                    ${canSelectMoreFiles ? "cursor-pointer" : "cursor-default"}
                `,
            })}
        >
            <input
                {...dropzone.getInputProps({
                    disabled: !canSelectMoreFiles,
                })}
            />
            {variant === "Past Papers" ? (
                <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                        if (!event.target.files) return;
                        void onAddFiles(Array.from(event.target.files));
                        event.target.value = "";
                    }}
                />
            ) : null}
            <svg
                className="mb-2 h-8 w-8 text-gray-400 sm:h-10 sm:w-10"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
            </svg>

            {files.length === 0 ? (
                <>
                    <p className="text-center text-sm text-gray-500">
                        {variant === "Past Papers"
                            ? "Drop a PDF or photo here"
                            : "Drop a PDF here"}
                    </p>
                    <p className="mt-1 text-center text-xs text-gray-400">
                        or click to browse
                    </p>
                    {variant === "Past Papers" ? (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                cameraInputRef.current?.click();
                            }}
                            className="mt-3 text-xs text-blue-600 hover:underline"
                        >
                            Use camera
                        </button>
                    ) : null}
                </>
            ) : (
                <p className="text-center text-sm text-gray-500">
                    {variant === "Notes"
                        ? `${files.length} PDF${files.length === 1 ? "" : "s"} selected`
                        : "PDF ready"}
                </p>
            )}
        </div>
    );
}

function SelectedFilesList({
    fileTitles,
    files,
    onRemoveFile,
    onTitleChange,
}: {
    fileTitles: string[];
    files: File[];
    onRemoveFile: (index: number) => void;
    onTitleChange: (index: number, value: string) => void;
}) {
    if (files.length === 0) return null;

    return (
        <div className="w-full space-y-2">
            {files.map((file, index) => (
                <div
                    key={`${file.name}-${file.lastModified}-${file.size}`}
                    className="flex w-full items-center gap-2"
                >
                    <UploadTitleField
                        value={fileTitles[index] ?? ""}
                        onChange={onTitleChange}
                        index={index}
                    />
                    <button
                        type="button"
                        className="flex h-10 w-10 shrink-0 items-center justify-center text-red-500"
                        onClick={() => onRemoveFile(index)}
                        aria-label={`Remove ${file.name}`}
                    >
                        <FontAwesomeIcon icon={faCircleXmark} />
                    </button>
                </div>
            ))}
        </div>
    );
}

function useUploadFileController({ variant, courses }: UploadFileProps) {
    const [state, dispatch] = useReducer(
        uploadFormReducer,
        initialUploadFormState,
    );
    const [pending, startTransition] = useTransition();
    const cameraInputRef = useRef<HTMLInputElement | null>(null);
    const fieldId = useId();

    const ids: UploadFieldIds = {
        formId: `${fieldId}-form`,
        examTypeId: `${fieldId}-exam-type`,
        slotId: `${fieldId}-slot`,
        yearId: `${fieldId}-year`,
        semesterId: `${fieldId}-semester`,
        campusId: `${fieldId}-campus`,
        bundleTitleId: `${fieldId}-bundle-title`,
        addMoreImagesId: `${fieldId}-add-more-images`,
    };

    const { toast } = useToast();
    const router = useRouter();
    const { requireAuth } = useGuestPrompt();

    const {
        campusVal,
        courseId,
        error,
        examType,
        fileTitles,
        files,
        hasAnswerKey,
        imageBundleFiles,
        isConverting,
        isDragging,
        isImageBundleMode,
        semesterVal,
        slot,
        year,
    } = state;

    const updateField = useCallback<UploadFieldChange>((field, value) => {
        dispatch({
            type: "patch",
            payload: { [field]: value } as Partial<UploadFormState>,
        });
    }, []);

    const imagePreviewUrls = useMemo(
        () =>
            imageBundleFiles.map((file) => ({
                key: `${file.name}-${file.lastModified}-${file.size}`,
                url: URL.createObjectURL(file),
            })),
        [imageBundleFiles],
    );

    useEffect(() => {
        return () => {
            imagePreviewUrls.forEach(({ url }) => URL.revokeObjectURL(url));
        };
    }, [imagePreviewUrls]);

    const convertImagesToPdfFile = useCallback(async (imageFiles: File[]) => {
        const { PDFDocument } = await import("pdf-lib");
        const pdfDoc = await PDFDocument.create();

        const embedImage = async (file: File) => {
            const bitmap = await createImageBitmap(file, {
                imageOrientation: "from-image",
            });
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext("2d");

            if (!ctx) {
                bitmap.close();
                throw new Error("Canvas not available");
            }

            ctx.drawImage(bitmap, 0, 0);
            bitmap.close();

            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((result) => {
                    if (!result) {
                        reject(new Error("Image conversion failed"));
                        return;
                    }
                    resolve(result);
                }, "image/jpeg", 0.92);
            });

            return pdfDoc.embedJpg(await blob.arrayBuffer());
        };

        for (const file of imageFiles) {
            const embeddedImage = await embedImage(file);
            const { width, height } = embeddedImage.scale(1);
            const page = pdfDoc.addPage([width, height]);
            page.drawImage(embeddedImage, { x: 0, y: 0, width, height });
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], {
            type: "application/pdf",
        });
        const baseName = stripExtension(imageFiles[0]?.name || "capture");
        const fileName = `${baseName}-bundle.pdf`;

        return new File([blob], fileName, { type: "application/pdf" });
    }, []);

    const addFiles = useCallback(
        async (incomingFiles: File[]) => {
            if (!incomingFiles.length) return;

            const pdfFiles: File[] = [];
            const imageFiles: File[] = [];

            for (const file of incomingFiles) {
                if (isPdfFile(file)) {
                    pdfFiles.push(file);
                    continue;
                }
                if (variant === "Past Papers" && isImageFile(file)) {
                    imageFiles.push(file);
                    continue;
                }
                toast({
                    title: "Unsupported file type",
                    variant: "destructive",
                });
            }

            if (variant === "Past Papers" && imageFiles.length && pdfFiles.length) {
                toast({
                    title: "Drop images or a PDF — not both at once",
                    variant: "destructive",
                });
                return;
            }

            if (variant === "Past Papers" && imageFiles.length) {
                if (files.length > 0 && !isImageBundleMode) {
                    toast({
                        title: "Remove the existing PDF before adding images",
                        variant: "destructive",
                    });
                    return;
                }

                dispatch({ type: "patch", payload: { isConverting: true } });

                try {
                    const mergedImageFiles = [...imageBundleFiles, ...imageFiles];
                    const mergedPdf = await convertImagesToPdfFile(mergedImageFiles);
                    const existingTitle = fileTitles[0]?.trim();

                    dispatch({
                        type: "patch",
                        payload: {
                            imageBundleFiles: mergedImageFiles,
                            isImageBundleMode: true,
                            files: [mergedPdf],
                            fileTitles: [
                                existingTitle || stripExtension(mergedPdf.name),
                            ],
                        },
                    });
                } catch (conversionError) {
                    console.error("Failed to convert images:", conversionError);
                    toast({
                        title: "Could not process images",
                        variant: "destructive",
                    });
                } finally {
                    dispatch({ type: "patch", payload: { isConverting: false } });
                }
                return;
            }

            if (variant === "Past Papers" && pdfFiles.length && isImageBundleMode) {
                toast({
                    title: "Remove the image pages before adding a PDF",
                    variant: "destructive",
                });
                return;
            }

            if (pdfFiles.length) {
                if (variant === "Past Papers" && (files.length > 0 || pdfFiles.length > 1)) {
                    toast({
                        title: "Only one PDF allowed per upload",
                        variant: "destructive",
                    });
                    return;
                }

                dispatch({
                    type: "patch",
                    payload: {
                        files: [...files, ...pdfFiles],
                        fileTitles: [
                            ...fileTitles,
                            ...pdfFiles.map((file) => stripExtension(file.name)),
                        ],
                    },
                });
            }
        },
        [
            convertImagesToPdfFile,
            fileTitles,
            files,
            imageBundleFiles,
            isImageBundleMode,
            toast,
            variant,
        ],
    );

    const dropzone = useDropzone({
        onDrop: (acceptedFiles: File[]) => {
            void addFiles(acceptedFiles);
            updateField("isDragging", false);
        },
        onDragEnter: () => updateField("isDragging", true),
        onDragLeave: () => updateField("isDragging", false),
        multiple: variant !== "Past Papers",
        maxFiles: variant === "Past Papers" ? 1 : undefined,
        accept:
            variant === "Past Papers" && !isImageBundleMode
                ? {
                    "application/pdf": [".pdf"],
                    "image/*": [".png", ".jpg", ".jpeg", ".heic", ".heif"],
                }
                : {
                    "application/pdf": [".pdf"],
                },
    });

    const handleTitleChange = useCallback((index: number, value: string) => {
        dispatch({ type: "update_title", index, value });
    }, []);

    const handleRemoveFile = useCallback(
        (index: number) => {
            const nextFiles = files.filter((_, fileIndex) => fileIndex !== index);
            const nextTitles = fileTitles.filter(
                (_, titleIndex) => titleIndex !== index,
            );

            dispatch({
                type: "patch",
                payload: {
                    files: nextFiles,
                    fileTitles: nextTitles,
                    ...(variant === "Past Papers" && nextFiles.length === 0
                        ? {
                            imageBundleFiles: [],
                            isImageBundleMode: false,
                        }
                        : {}),
                },
            });
        },
        [fileTitles, files, variant],
    );

    const handleSubmit = useCallback(
        async (event: React.FormEvent) => {
            event.preventDefault();

            if (!requireAuth(`upload ${variant.toLowerCase()}`)) {
                return;
            }

            dispatch({ type: "patch", payload: { error: "" } });

            if (files.length === 0) {
                dispatch({
                    type: "patch",
                    payload: { error: "Please select at least one file to upload." },
                });
                return;
            }

            if (courses?.length && !courseId) {
                dispatch({
                    type: "patch",
                    payload: { error: "Please select a course." },
                });
                return;
            }

            if (variant === "Past Papers" && courses?.length) {
                if (!examType) {
                    dispatch({
                        type: "patch",
                        payload: { error: "Please select an exam type." },
                    });
                    return;
                }
                if (!year) {
                    dispatch({
                        type: "patch",
                        payload: { error: "Please select a year." },
                    });
                    return;
                }
            }

            startTransition(async () => {
                try {
                    const processorBaseUrl =
                        process.env.NEXT_PUBLIC_MICROSERVICE_URL?.replace(/\/$/, "");
                    if (!processorBaseUrl) {
                        throw new Error("Upload processor URL is not configured.");
                    }

                    const formDatas = files.map((file, index) => {
                        const formData = new FormData();
                        formData.append("file", file);
                        formData.append("filetitle", fileTitles[index]);
                        return formData;
                    });

                    const promises = formDatas.map(async (formData) => {
                        const response = await fetch(
                            `${processorBaseUrl}/process_pdf`,
                            {
                                method: "POST",
                                body: formData,
                            },
                        );

                        if (!response.ok) {
                            const errorText = await response.text().catch(() => "");
                            const details = errorText
                                ? `: ${errorText.slice(0, 240)}`
                                : "";
                            throw new Error(
                                `Failed to upload file ${formData.get("filetitle")}${details}`,
                            );
                        }

                        const payload = await response.json();
                        return normalizeProcessedUploadResult(
                            payload,
                            String(formData.get("filetitle") ?? "Untitled"),
                        );
                    });

                    const results = await Promise.all(promises);
                    const failedResult = results.find(
                        (result) => result.message !== PROCESSOR_SUCCESS_MESSAGE,
                    );
                    if (failedResult) {
                        throw new Error(failedResult.message);
                    }

                    const saveResponse = await fetch("/api/uploads", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            results,
                            year,
                            slot,
                            variant,
                            courseId,
                            examType: examType || null,
                            semester: semesterVal || null,
                            campus: campusVal || null,
                            hasAnswerKey,
                        }),
                    });
                    const savePayload = (await saveResponse
                        .json()
                        .catch(() => null)) as UploadSaveResponse | null;

                    if (!saveResponse.ok || !savePayload?.success) {
                        throw new Error(
                            savePayload?.error ?? "Failed to save upload metadata.",
                        );
                    }

                    toast({ title: "Selected files uploaded successfully." });
                    router.push(variant === "Past Papers" ? "/past_papers" : "/notes");
                } catch (uploadError) {
                    console.error("Error uploading files:", uploadError);
                    dispatch({
                        type: "patch",
                        payload: {
                            error: `Error uploading files: ${
                                uploadError instanceof Error
                                    ? uploadError.message
                                    : "Unknown error"
                            }`,
                        },
                    });
                }
            });
        },
        [
            campusVal,
            courseId,
            courses?.length,
            examType,
            fileTitles,
            files,
            hasAnswerKey,
            requireAuth,
            router,
            semesterVal,
            slot,
            toast,
            variant,
            year,
        ],
    );

    const canSelectMoreFiles = variant !== "Past Papers" || files.length === 0;
    const hasCourseSelection = Boolean(courses?.length);

    return {
        addFiles,
        cameraInputRef,
        canSelectMoreFiles,
        dropzone,
        handleRemoveFile,
        handleSubmit,
        handleTitleChange,
        hasCourseSelection,
        ids,
        imagePreviewUrls,
        pending,
        state,
        updateField,
    };
}

function UploadFile({ variant, courses }: UploadFileProps) {
    const {
        addFiles,
        cameraInputRef,
        canSelectMoreFiles,
        dropzone,
        handleRemoveFile,
        handleSubmit,
        handleTitleChange,
        hasCourseSelection,
        ids,
        imagePreviewUrls,
        pending,
        state,
        updateField,
    } = useUploadFileController({ variant, courses });

    const {
        campusVal,
        courseId,
        error,
        examType,
        fileTitles,
        files,
        hasAnswerKey,
        imageBundleFiles,
        isConverting,
        isDragging,
        isImageBundleMode,
        semesterVal,
        slot,
        year,
    } = state;

    return (
        <div className="flex min-h-screen items-start justify-center px-3 py-4 sm:items-center sm:p-6">
            <div className="w-full max-w-md border-2 border-dashed border-[#D5D5D5] bg-white p-4 text-black shadow-lg dark:bg-[#0C1222] dark:text-[#D5D5D5] sm:p-6">
                <UploadHeader
                    formId={ids.formId}
                    pending={pending}
                    variant={variant}
                />

                <form
                    id={ids.formId}
                    onSubmit={handleSubmit}
                    className="w-full space-y-4"
                >
                    {hasCourseSelection && courses ? (
                        <CourseField
                            courseId={courseId}
                            courses={courses}
                            updateField={updateField}
                        />
                    ) : null}

                    {variant === "Past Papers" && hasCourseSelection ? (
                        <PastPaperMetadataFields
                            campusVal={campusVal}
                            examType={examType}
                            hasAnswerKey={hasAnswerKey}
                            ids={ids}
                            semesterVal={semesterVal}
                            slot={slot}
                            updateField={updateField}
                            year={year}
                        />
                    ) : null}

                    {!hasCourseSelection ? (
                        <BasicMetadataFields
                            slot={slot}
                            updateField={updateField}
                            year={year}
                        />
                    ) : null}

                    {variant === "Past Papers" && isImageBundleMode ? (
                        <ImageBundleSection
                            addMoreImagesId={ids.addMoreImagesId}
                            bundleTitleId={ids.bundleTitleId}
                            cameraInputRef={cameraInputRef}
                            imageBundleFiles={imageBundleFiles}
                            imagePreviewUrls={imagePreviewUrls}
                            isConverting={isConverting}
                            onAddFiles={addFiles}
                            onRemoveAll={() => handleRemoveFile(0)}
                            onTitleChange={handleTitleChange}
                            title={fileTitles[0] ?? ""}
                        />
                    ) : (
                        <>
                            <PdfDropzoneSection
                                cameraInputRef={cameraInputRef}
                                canSelectMoreFiles={canSelectMoreFiles}
                                dropzone={dropzone}
                                files={files}
                                isDragging={isDragging}
                                onAddFiles={addFiles}
                                variant={variant}
                            />
                            <SelectedFilesList
                                fileTitles={fileTitles}
                                files={files}
                                onRemoveFile={handleRemoveFile}
                                onTitleChange={handleTitleChange}
                            />
                        </>
                    )}

                    {error ? (
                        <div className="mb-4 text-center">
                            <span className="text-red-500">{error}</span>
                        </div>
                    ) : null}
                </form>
            </div>
        </div>
    );
}

export default UploadFile;
