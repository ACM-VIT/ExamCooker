"use client"
import React, {useState, useCallback, useTransition} from 'react';
import Link from 'next/link';
import {useDropzone} from 'react-dropzone';
import uploadFile from "../actions/uploadFile";
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faArrowLeft, faCircleXmark} from '@fortawesome/free-solid-svg-icons';
import {removePdfExtension} from './NotesCard';
import Loading from '../loading';
import TagsInput from "@/app/components/tagsInput";
import {useToast} from "@/components/ui/use-toast";
import {useRouter} from "next/navigation";
import { useGuestPrompt } from "@/app/components/GuestPromptProvider";

const years = ['2020', '2021', '2022', '2023', '2024', '2025', '2026'];

const UploadFile = ({allTags, variant}: { allTags: string[], variant: "Notes" | "Past Papers" }) => {
    const [fileTitles, setFileTitles] = useState<string[]>([]);
    const [year, setYear] = useState('');
    const [slot, setSlot] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState("");
    const [pending, startTransition] = useTransition();

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

                const response = await uploadFile({results, tags: selectedTags, year, slot, variant});
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

    const {getRootProps, getInputProps} = useDropzone({
        onDrop: (acceptedFiles: File[]) => {
            setFiles(f => [...f, ...acceptedFiles]);
            setFileTitles(f => [...f, ...acceptedFiles.map(file => removePdfExtension(file.name))])
            setIsDragging(false);
        },
        onDragEnter: () => setIsDragging(true),
        onDragLeave: () => setIsDragging(false),
        multiple: true,
        accept: {
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
        setFiles(f => f.filter((_, i) => i !== index));
        setFileTitles(f => f.filter((_, i) => i !== index));
    };

    const TextField = useCallback(({value, onChange, index}: {
        value: string,
        onChange: (index: number, value: string) => void,
        index: number
    }) => {
        return (
            <input
                type="text"
                className={`p-2 border-2 border-dashed dark:bg-[#0C1222] border-gray-300 w-full text-black dark:text-[#D5D5D5] text-lg font-bold`}
                value={value}
                onChange={(e) => onChange(index, e.target.value)}
                required
            />
        );
    }, []);
    return (
        <div className="flex justify-center items-center min-h-screen">
            {pending && <Loading/>}
            <div
                className="bg-white dark:bg-[#0C1222] p-6 shadow-lg w-full max-w-md border-dashed border-2 border-[#D5D5D5] text-black dark:text-[#D5D5D5] ">
                <div className="flex justify-between items-center mb-4">
                    <Link href={'/notes'}>
                        <button
                            className="text-[#3BF3C7] px-2 py-2 border-2 border-[#3BF3C7] flex items-center justify-center font-bold hover:bg-[#ffffff]/10">
                            <FontAwesomeIcon icon={faArrowLeft}/>
                        </button>
                    </Link>
                    <h3>New {variant}</h3>
                    <div className="relative group">
                        <div className="absolute inset-0 bg-black dark:bg-[#3BF4C7]"/>
                        <div
                            className="dark:absolute dark:inset-0 dark:blur-[75px] dark:lg:bg-none lg:dark:group-hover:bg-[#3BF4C7] transition dark:group-hover:duration-200 duration-1000"/>
                        <button type="submit" onClick={handleSubmit} disabled={pending}
                                className="dark:text-[#D5D5D5] dark:group-hover:text-[#3BF4C7] dark:group-hover:border-[#3BF4C7] dark:border-[#D5D5D5] dark:bg-[#0C1222] border-black border-2 relative px-4 py-2 text-lg bg-[#3BF4C7] text-black font-bold group-hover:-translate-x-1 group-hover:-translate-y-1 transition duration-150">
                            {pending ? "Uploading..." : "Upload"}
                        </button>
                    </div>

                </div>
                <form onSubmit={handleSubmit} className='w-full'>
                    <div className="grid grid-cols-2 gap-4 mb-4 place-content-center">
                        <div>
                            <select
                                className="p-2 w-full bg-[#5FC4E7] dark:bg-[#008A90] cursor-pointer transition-colors duration-300 hover:bg-opacity-85"
                                value={year}
                                onChange={(e) => setYear(e.target.value)}
                                required
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
                                required
                            >
                                <option value="">Slot</option>
                                <option value="A1">A1</option>
                                <option value="A2">A2</option>
                                <option value="B1">B1</option>
                                <option value="B2">B2</option>
                                <option value="C1">C1</option>
                                <option value="C2">C2</option>
                                <option value="D1">D1</option>
                                <option value="D2">D2</option>
                                <option value="E1">E1</option>
                                <option value="E2">E2</option>
                                <option value="F1">F1</option>
                                <option value="F2">F2</option>
                                <option value="G1">G1</option>
                                <option value="G2">G2</option>
                            </select>
                        </div>
                    </div>

                    <TagsInput allTags={allTags} selectedTags={selectedTags} setSelectedTags={setSelectedTags}/>

                    <div
                        {...getRootProps()}
                        className={`
                            border-2 border-dashed
                            ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
                            transition-all duration-300 ease-in-out
                            flex flex-col items-center justify-center
                            p-4 sm:p-6 md:p-8
                            h-32 sm:h-40 md:h-48
                            mb-4 cursor-pointer
                        `}
                    >
                        <input {...getInputProps()} />
                        <svg
                            className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-gray-400 mb-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                        </svg>
                        <p className="text-sm sm:text-base md:text-lg text-gray-500 text-center">
                            Drag & drop files here, or click here
                        </p>
                        {files.length > 0 && (
                            <p className="text-xs sm:text-sm md:text-base text-gray-500 mt-2">
                                {files.length} file(s) selected
                            </p>
                        )}
                    </div>

                    {files.length > 0 && (
                        <div className="flex flex-col gap-2 w-[100%]">
                            {files.map((_, index) => (
                                <div key={index} className="text-gray-700 flex items-center text-xs w-full">
                                    {/* <span key={index} className="text-gray-700 flex gap-2 items-center text-xs"> */}
                                    <TextField
                                        value={fileTitles[index]}
                                        onChange={handleTitleChange}
                                        index={index}/>

                                    <button
                                        type="button"
                                        className="ml-2 text-red-500"
                                        onClick={() => handleRemoveFile(index)}
                                    >
                                        <FontAwesomeIcon icon={faCircleXmark}/>
                                    </button>
                                    {/* </span> */}
                                </div>
                            ))}
                        </div>
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
