"use client"
import React, {useState, useCallback, useTransition, useRef} from 'react';
import Link from 'next/link';
import {useDropzone} from 'react-dropzone';
import uploadFile from "../actions/uploadFile";
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faArrowLeft, faCircleXmark} from '@fortawesome/free-solid-svg-icons';
import Loading from '../loading';
import {useToast} from "@/components/ui/use-toast";
import {useRouter} from "next/navigation";
import { useGuestPrompt } from "@/app/components/GuestPromptProvider";
import CoursePicker, { type CourseOption } from "@/app/components/mod/CoursePicker";

const years = ['2020', '2021', '2022', '2023', '2024', '2025', '2026'];
const isPdfFile = (file: File) =>
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
const isImageFile = (file: File) => file.type.startsWith("image/");
const stripExtension = (filename: string) => filename.replace(/\.[^/.]+$/, "");

const EXAM_TYPES = [
    { value: 'CAT_1', label: 'CAT-1' },
    { value: 'CAT_2', label: 'CAT-2' },
    { value: 'FAT', label: 'FAT' },
    { value: 'MODEL_CAT_1', label: 'Model CAT-1' },
    { value: 'MODEL_CAT_2', label: 'Model CAT-2' },
    { value: 'MODEL_FAT', label: 'Model FAT' },
    { value: 'MID', label: 'Mid' },
    { value: 'QUIZ', label: 'Quiz' },
    { value: 'CIA', label: 'CIA' },
    { value: 'OTHER', label: 'Other' },
];

const SEMESTERS = [
    { value: 'FALL', label: 'Fall' },
    { value: 'WINTER', label: 'Winter' },
    { value: 'SUMMER', label: 'Summer' },
    { value: 'WEEKEND', label: 'Weekend' },
];

const CAMPUSES = [
    { value: 'CHENNAI', label: 'Chennai' },
    { value: 'AP', label: 'AP' },
    { value: 'BHOPAL', label: 'Bhopal' },
    { value: 'BANGALORE', label: 'Bangalore' },
    { value: 'MAURITIUS', label: 'Mauritius' },
];

const SELECT_CLASS = "p-2 w-full bg-[#5FC4E7] dark:bg-[#008A90] cursor-pointer transition-colors duration-300 hover:bg-opacity-85 text-sm";

const UploadFile = ({variant, courses}: { variant: "Notes" | "Past Papers", courses?: CourseOption[] }) => {
    const [fileTitles, setFileTitles] = useState<string[]>([]);
    const [year, setYear] = useState('');
    const [slot, setSlot] = useState('');
    const [courseId, setCourseId] = useState<string | null>(null);
    const [examType, setExamType] = useState('');
    const [semesterVal, setSemesterVal] = useState('');
    const [campusVal, setCampusVal] = useState('');
    const [hasAnswerKey, setHasAnswerKey] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState("");
    const [pending, startTransition] = useTransition();
    const [isConverting, setIsConverting] = useState(false);
    const [imageBundleFiles, setImageBundleFiles] = useState<File[]>([]);
    const [isImageBundleMode, setIsImageBundleMode] = useState(false);
    const cameraInputRef = useRef<HTMLInputElement | null>(null);

    const {toast} = useToast();
    const router = useRouter();
    const { requireAuth } = useGuestPrompt();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!requireAuth(`upload ${variant.toLowerCase()}`)) {
            return;
        }
        setError("");

        if (files.length === 0) {
            setError("Please select at least one file to upload.");
            return;
        }

        if (courses?.length && !courseId) {
            setError("Please select a course.");
            return;
        }

        if (variant === "Past Papers" && courses?.length) {
            if (!examType) { setError("Please select an exam type."); return; }
            if (!year) { setError("Please select a year."); return; }
        }

        startTransition(async () => {
            try {
                const formDatas = files.map((file, index) => {
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("filetitle", fileTitles[index]);
                    return formData;
                })
                const promises = formDatas.map(async (formData) => {

                    const response = await fetch(`${process.env.NEXT_PUBLIC_MICROSERVICE_URL}/process_pdf`, {
                        method: "POST",
                        body: formData,
                    });

                    if (!response.ok) {
                        console.log(response);
                        throw new Error(`Failed to upload file ${formData.get("fileTitle")}`);
                    }

                    return await response.json();
                });

                const results = await Promise.all(promises) as {
                    fileUrl: string,
                    thumbnailUrl: string,
                    filename: string,
                    message: string
                }[];

                const response = await uploadFile({
                    results,
                    year,
                    slot,
                    variant,
                    courseId,
                    examType: examType || null,
                    semester: semesterVal || null,
                    campus: campusVal || null,
                    hasAnswerKey,
                });
                if (!response.success) {
                    setError("Error uploading files: " + response.error);
                    return;
                }

                toast({title: "Selected files uploaded successfully."})

                router.push(`/past_papers`)

                // todo delete the next 5 lines and uncomment the previous line
                // setFiles([]);
                // setSelectedTags([]);
                // setYear('');
                // setSlot('');
                // setFileTitles([]);

            } catch (error) {
                console.error("Error uploading files:", error);
                setError(`Error uploading files: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    };

    const convertImagesToPdfFile = useCallback(async (imageFiles: File[]) => {
        const { PDFDocument } = await import("pdf-lib");
        const pdfDoc = await PDFDocument.create();

        const embedImage = async (file: File) => {
            // createImageBitmap with imageOrientation respects EXIF rotation on mobile photos.
            const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) { bitmap.close(); throw new Error("Canvas not available"); }
            ctx.drawImage(bitmap, 0, 0);
            bitmap.close();

            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((result) => {
                    if (!result) { reject(new Error("Image conversion failed")); return; }
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
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
        const baseName = stripExtension(imageFiles[0]?.name || "capture");
        const fileName = `${baseName}-bundle.pdf`;
        return new File([blob], fileName, { type: "application/pdf" });
    }, []);

    const addFiles = useCallback(async (incomingFiles: File[]) => {
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
            toast({ title: "Drop images or a PDF — not both at once", variant: "destructive" });
            return;
        }

        if (variant === "Past Papers" && imageFiles.length) {
            if (files.length > 0 && !isImageBundleMode) {
                toast({ title: "Remove the existing PDF before adding images", variant: "destructive" });
                return;
            }
            setIsConverting(true);
            try {
                const mergedImageFiles = [...imageBundleFiles, ...imageFiles];
                const mergedPdf = await convertImagesToPdfFile(mergedImageFiles);
                const existingTitle = fileTitles[0]?.trim();
                setImageBundleFiles(mergedImageFiles);
                setIsImageBundleMode(true);
                setFiles([mergedPdf]);
                setFileTitles([existingTitle || stripExtension(mergedPdf.name)]);
            } catch (error) {
                console.error("Failed to convert images:", error);
                toast({ title: "Could not process images", variant: "destructive" });
            } finally {
                setIsConverting(false);
            }
            return;
        }

        if (variant === "Past Papers" && pdfFiles.length && isImageBundleMode) {
            toast({ title: "Remove the image pages before adding a PDF", variant: "destructive" });
            return;
        }

        if (pdfFiles.length) {
            if (variant === "Past Papers" && (files.length > 0 || pdfFiles.length > 1)) {
                toast({ title: "Only one PDF allowed per upload", variant: "destructive" });
                return;
            }
            setFiles((prev) => [...prev, ...pdfFiles]);
            setFileTitles((prev) => [
                ...prev,
                ...pdfFiles.map((file) => stripExtension(file.name)),
            ]);
        }
    }, [convertImagesToPdfFile, fileTitles, files.length, imageBundleFiles, isImageBundleMode, toast, variant]);

    const {getRootProps, getInputProps} = useDropzone({
        onDrop: (acceptedFiles: File[]) => {
            void addFiles(acceptedFiles);
            setIsDragging(false);
        },
        onDragEnter: () => setIsDragging(true),
        onDragLeave: () => setIsDragging(false),
        multiple: variant !== "Past Papers",
        maxFiles: variant === "Past Papers" ? 1 : undefined,
        accept: variant === "Past Papers" && !isImageBundleMode
            ? {
                'application/pdf': ['.pdf'],
                'image/*': ['.png', '.jpg', '.jpeg', '.heic', '.heif'],
            }
            : {
                'application/pdf': ['.pdf'],
            },
    });

    const handleTitleChange = useCallback((index: number, value: string) => {
        setFileTitles(prevTitles => {
            const newTitles = [...prevTitles];
            newTitles[index] = value;
            return newTitles;
        });
    }, []);

    const handleRemoveFile = (index: number) => {
        const nextFiles = files.filter((_, i) => i !== index);
        const nextTitles = fileTitles.filter((_, i) => i !== index);
        setFiles(nextFiles);
        setFileTitles(nextTitles);
        if (variant === "Past Papers" && nextFiles.length === 0) {
            setImageBundleFiles([]);
            setIsImageBundleMode(false);
        }
    };

    const TextField = useCallback(({value, onChange, index}: {
        value: string,
        onChange: (index: number, value: string) => void,
        index: number
    }) => {
        return (
            <input
                type="text"
                className={`p-2 border-2 border-dashed dark:bg-[#0C1222] border-gray-300 w-full text-black dark:text-[#D5D5D5] text-sm sm:text-base font-bold`}
                value={value}
                onChange={(e) => onChange(index, e.target.value)}
                required
            />
        );
    }, []);

    const canSelectMoreFiles = variant !== "Past Papers" || files.length === 0;

    return (
        <div className="flex justify-center items-start sm:items-center min-h-screen px-3 py-4 sm:p-6">
            {pending && <Loading/>}
            <div
                className="bg-white dark:bg-[#0C1222] p-4 sm:p-6 shadow-lg w-full max-w-md border-dashed border-2 border-[#D5D5D5] text-black dark:text-[#D5D5D5]">
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-4 mb-4">
                    <Link href={variant === "Past Papers" ? "/past_papers" : "/notes"}>
                        <button
                            className="text-[#3BF3C7] h-10 w-10 border-2 border-[#3BF3C7] flex items-center justify-center font-bold hover:bg-[#ffffff]/10">
                            <FontAwesomeIcon icon={faArrowLeft}/>
                        </button>
                    </Link>
                    <h3 className="text-center text-base sm:text-xl font-semibold truncate">New {variant}</h3>
                    <div className="relative group">
                        <div className="absolute inset-0 bg-black dark:bg-[#3BF4C7]"/>
                        <div
                            className="dark:absolute dark:inset-0 dark:blur-[75px] dark:lg:bg-none lg:dark:group-hover:bg-[#3BF4C7] transition dark:group-hover:duration-200 duration-1000"/>
                        <button type="submit" onClick={handleSubmit} disabled={pending}
                                className="dark:text-[#D5D5D5] dark:group-hover:text-[#3BF4C7] dark:group-hover:border-[#3BF4C7] dark:border-[#D5D5D5] dark:bg-[#0C1222] border-black border-2 relative px-3 sm:px-4 py-2 text-sm sm:text-lg whitespace-nowrap bg-[#3BF4C7] text-black font-bold group-hover:-translate-x-1 group-hover:-translate-y-1 transition duration-150">
                            {pending ? "Uploading..." : "Upload"}
                        </button>
                    </div>

                </div>
                <form onSubmit={handleSubmit} className='w-full space-y-4'>
                    {courses && courses.length > 0 && (
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-black/60 dark:text-[#D5D5D5]/60">
                                Course <span className="text-red-500">*</span>
                            </label>
                            <CoursePicker courses={courses} value={courseId} onChange={setCourseId} />
                        </div>
                    )}

                    {variant === "Past Papers" && courses && courses.length > 0 && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-black/60 dark:text-[#D5D5D5]/60">
                                        Exam type <span className="text-red-500">*</span>
                                    </label>
                                    <select className={SELECT_CLASS} value={examType} onChange={(e) => setExamType(e.target.value)}>
                                        <option value="">Select</option>
                                        {EXAM_TYPES.map((t) => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-black/60 dark:text-[#D5D5D5]/60">
                                        Slot
                                    </label>
                                    <select className={SELECT_CLASS} value={slot} onChange={(e) => setSlot(e.target.value)}>
                                        <option value="">None</option>
                                        {["A1","A2","B1","B2","C1","C2","D1","D2","E1","E2","F1","F2","G1","G2"].map((s) => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-black/60 dark:text-[#D5D5D5]/60">
                                        Year <span className="text-red-500">*</span>
                                    </label>
                                    <select className={SELECT_CLASS} value={year} onChange={(e) => setYear(e.target.value)}>
                                        <option value="">Select</option>
                                        {years.map((y) => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-black/60 dark:text-[#D5D5D5]/60">
                                        Semester
                                    </label>
                                    <select className={SELECT_CLASS} value={semesterVal} onChange={(e) => setSemesterVal(e.target.value)}>
                                        <option value="">Unknown</option>
                                        {SEMESTERS.map((s) => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-black/60 dark:text-[#D5D5D5]/60">
                                        Campus
                                    </label>
                                    <select className={SELECT_CLASS} value={campusVal} onChange={(e) => setCampusVal(e.target.value)}>
                                        <option value="">Vellore</option>
                                        {CAMPUSES.map((c) => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-end pb-2">
                                    <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-black dark:text-[#D5D5D5]">
                                        <input
                                            type="checkbox"
                                            checked={hasAnswerKey}
                                            onChange={(e) => setHasAnswerKey(e.target.checked)}
                                            className="h-4 w-4 accent-[#5FC4E7]"
                                        />
                                        Has answer key
                                    </label>
                                </div>
                            </div>
                        </>
                    )}

                    {!(courses && courses.length > 0) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 place-content-center">
                            <div>
                                <select
                                    className="p-2 w-full bg-[#5FC4E7] dark:bg-[#008A90] cursor-pointer transition-colors duration-300 hover:bg-opacity-85"
                                    value={year}
                                    onChange={(e) => setYear(e.target.value)}
                                >
                                    <option value="">Select Year</option>
                                    {years.map((y) => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <select
                                    className="p-2 w-full bg-[#5FC4E7] dark:bg-[#008A90] cursor-pointer transition-colors duration-300 hover:bg-opacity-85"
                                    value={slot}
                                    onChange={(e) => setSlot(e.target.value)}
                                >
                                    <option value="">Slot</option>
                                    {["A1","A2","B1","B2","C1","C2","D1","D2","E1","E2","F1","F2","G1","G2"].map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {variant === "Past Papers" && isImageBundleMode ? (
                        <div className="border-2 border-[#5FC4E7] dark:border-[#3BF4C7]/40 bg-[#5FC4E7]/10 dark:bg-[#3BF4C7]/5 p-4 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-black dark:text-[#D5D5D5]">
                                    {imageBundleFiles.length} image{imageBundleFiles.length !== 1 ? "s" : ""} selected
                                </p>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveFile(0)}
                                    className="text-red-500 shrink-0"
                                    aria-label="Remove all"
                                >
                                    <FontAwesomeIcon icon={faCircleXmark} />
                                </button>
                            </div>

                            <div className="flex gap-2 flex-wrap">
                                {imageBundleFiles.map((img, i) => (
                                    <img
                                        key={i}
                                        src={URL.createObjectURL(img)}
                                        alt={`Page ${i + 1}`}
                                        className="h-16 w-auto object-cover border border-black/20 dark:border-white/20"
                                    />
                                ))}
                            </div>

                            {isConverting && (
                                <p className="text-xs text-black/50 dark:text-[#D5D5D5]/50">
                                    Processing...
                                </p>
                            )}

                            <input
                                ref={cameraInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                multiple
                                className="hidden"
                                onChange={(event) => {
                                    if (!event.target.files) return;
                                    void addFiles(Array.from(event.target.files));
                                    event.target.value = "";
                                }}
                            />
                            <input
                                id="add-more-images"
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(event) => {
                                    if (!event.target.files) return;
                                    void addFiles(Array.from(event.target.files));
                                    event.target.value = "";
                                }}
                            />

                            <div className="flex gap-2 flex-wrap">
                                <label
                                    htmlFor="add-more-images"
                                    className="cursor-pointer inline-flex h-8 items-center border border-black/30 dark:border-[#D5D5D5]/30 px-3 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5"
                                >
                                    Add more pages
                                </label>
                                <button
                                    type="button"
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="inline-flex h-8 items-center border border-black/30 dark:border-[#D5D5D5]/30 px-3 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5"
                                >
                                    Use camera
                                </button>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-black/60 dark:text-[#D5D5D5]/60">
                                    Title
                                </label>
                                <TextField value={fileTitles[0] ?? ""} onChange={handleTitleChange} index={0} />
                            </div>
                        </div>
                    ) : (
                        /* PDF dropzone */
                        <>
                            <div
                                {...getRootProps()}
                                className={`
                                    border-2 border-dashed
                                    ${isDragging ? 'border-[#5FC4E7] bg-[#5FC4E7]/10' : 'border-gray-300'}
                                    transition-all duration-300 ease-in-out
                                    flex flex-col items-center justify-center
                                    p-4 sm:p-6 md:p-8
                                    min-h-[10rem] sm:min-h-[12rem]
                                    ${canSelectMoreFiles ? "cursor-pointer" : "cursor-default"}
                                `}
                            >
                                <input {...getInputProps()} disabled={!canSelectMoreFiles} />
                                {variant === "Past Papers" && (
                                    <input
                                        ref={cameraInputRef}
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        multiple
                                        className="hidden"
                                        onChange={(event) => {
                                            if (!event.target.files) return;
                                            void addFiles(Array.from(event.target.files));
                                            event.target.value = "";
                                        }}
                                    />
                                )}
                                <svg
                                    className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400 mb-2"
                                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>

                                {files.length === 0 ? (
                                    <>
                                        <p className="text-sm text-gray-500 text-center">
                                            {variant === "Past Papers"
                                                ? "Drop a PDF or photo here"
                                                : "Drop a PDF here"}
                                        </p>
                                        <p className="text-xs text-gray-400 text-center mt-1">or click to browse</p>
                                        {variant === "Past Papers" && (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                                                className="mt-3 text-xs text-blue-600 hover:underline"
                                            >
                                                Use camera
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-sm text-gray-500 text-center">
                                        {variant === "Notes"
                                            ? `${files.length} PDF${files.length === 1 ? "" : "s"} selected`
                                            : "PDF ready"}
                                    </p>
                                )}
                            </div>

                            {files.length > 0 && (
                                <div className="w-full space-y-2">
                                    {files.map((file, index) => (
                                        <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-2 w-full">
                                            <TextField value={fileTitles[index] ?? ""} onChange={handleTitleChange} index={index} />
                                            <button
                                                type="button"
                                                className="text-red-500 h-10 w-10 flex items-center justify-center shrink-0"
                                                onClick={() => handleRemoveFile(index)}
                                                aria-label={`Remove ${file.name}`}
                                            >
                                                <FontAwesomeIcon icon={faCircleXmark} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                    {error && (
                        <div className="mb-4 text-center">
                            <span className="text-red-500">{error}</span>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );

}

export default UploadFile;
