"use client"
import React, { useState, useRef, useEffect, useMemo, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useDropzone } from 'react-dropzone';
import { generateSignedUploadURL, storeFileInfoInDatabase } from "../actions/uploadFile";
import cuid from 'cuid';
import Fuse from 'fuse.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { removePdfExtension } from './NotesCard';
import { useRouter } from 'next/navigation';
import Loading from '../loading';

const years = ['2020', '2021', '2022', '2023', '2024'];
const slots = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', 'E1', 'E2', 'F1', 'F2', 'G1', 'G2'];

const filterYearAndSlot = (tags: string[]) => {
    const yearRegex = /^(2\d{3}|3000)$/;
    return tags.filter(tag => !yearRegex.test(tag) && !slots.includes(tag));
};

const UploadFileNotes = ({allTags} : {allTags: string[]}) => {
    const [fileTitles, setFileTitles] = useState<string[]>([]);
    const [year, setYear] = useState('');
    const [slot, setSlot] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');
    const [isAddingTag, setIsAddingTag] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState("");
    const [fileUploadStatus, setFileUploadStatus] = useState<{ [key: string]: string }>({});
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState("");
    const [filteredTags, setFilteredTags] = useState<string[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [tagsLoaded, setTagsLoaded] = useState(false);
    const [pending, startTransition] = useTransition();
    const [tagInput, setTagInput] = useState("");
    
    const router = useRouter();
    const dropdownRef = useRef<HTMLDivElement>(null);

    const availableTags = useMemo(() => {
        return filterYearAndSlot(allTags)
      }, [allTags])

    const fuse = useMemo(() => new Fuse(availableTags, {
        threshold: 0.6,
        minMatchCharLength: 2,
    }), [availableTags]);

    // useEffect(() => {
    //     async function fetchTags() {
    //         try {
    //             const fetchedTags = await getTags()
    //             const filteredTags = filterYearAndSlot(fetchedTags, years, slots);
    //             setAvailableTags(filteredTags)
    //             setFilteredTags(filteredTags)
    //             setTagsLoaded(true)
    //         } catch (error) {
    //             console.error('Error fetching tags:', error)
    //         }
    //     }
    //     fetchTags()
    // }, [])

    useEffect(() => {
        setShowDropdown(false);
        if (tagInput) {
          const results = fuse.search(tagInput);
          setFilteredTags(results.map(result => result.item));
        } else {
          setFilteredTags(availableTags);
        }
      }, [fuse, tagInput])

    const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { setNewTag(e.target.value) };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        startTransition(async () => {
            setUploading(true);
            setMessage("");
            setError("");

            if (files.length === 0) {
                setError("Please select at least one file to upload.");
                setUploading(false);
                return;
            }

            try {
                for (const file of files) {
                    const filename = `${file.name}-${cuid()}`;
                    const { url, fields } = await generateSignedUploadURL(filename);

                    const formData = new FormData();
                    Object.entries({ ...fields, file }).forEach(([key, value]) => {
                        formData.append(key, value as string | Blob);
                    });

                    setFileUploadStatus((prevStatus) => ({
                        ...prevStatus,
                        [file.name]: "Uploading",
                    }));

                    const uploadResponse = await fetch(url, {
                        method: 'POST',
                        body: formData,
                    });

                    if (!uploadResponse.ok) {
                        throw new Error(`Failed to upload file: ${file.name}`);
                    }

                    const fileUrl = `${url}${filename}`;


                    const yearValue = year.trim() !== '' ? year : undefined;
                    const slotValue = slot.trim() !== '' ? slot : undefined;
                    await storeFileInfoInDatabase(
                        file.name,
                        fileUrl,
                        "Note",
                        selectedTags,
                        yearValue,
                        slotValue
                    );

                    setFileUploadStatus((prevStatus) => ({
                        ...prevStatus,
                        [file.name]: "Uploaded",
                    }));
                }

                setMessage("Files uploaded successfully!");
            } catch (error) {
                console.error("Error uploading files:", error);
                setError(`Error uploading files: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
                setUploading(false);
                setFiles([]);
                setSelectedTags([]);
                setYear('');
                setSlot('');
            }
        })
    };

    const handleTagSelect = (tag: string) => {
        if (!selectedTags.includes(tag)) {
            setSelectedTags([...selectedTags, tag]);
        }
        setTagInput('');
        setShowDropdown(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (!filteredTags.length) return;
            handleTagSelect(filteredTags[0]);
          }
    };

    const handleRemoveTag = (tag: string) => {
        setSelectedTags(selectedTags.filter(t => t !== tag));
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);


    // useEffect(() => {
    //     if (tagsLoaded) {
    //         console.log("Available tags:", availableTags)
    //     }
    // }, [availableTags, tagsLoaded])

    // const handleAddTagClick = () => {
    //     setIsAddingTag(true);
    //     setShowDropdown(true);
    //     setFilteredTags(availableTags);
    // };

    const { getRootProps, getInputProps } = useDropzone({
        onDrop: (acceptedFiles: File[]) => {
            setFiles([...files, ...acceptedFiles]);
            setFileTitles([...fileTitles, ...acceptedFiles.map(file => removePdfExtension(file.name))])
            setIsDragging(false);
        },
        onDragEnter: () => setIsDragging(true),
        onDragLeave: () => setIsDragging(false),
        multiple: true
    });
    const handleTitleChange = useCallback((index: number, value: string) => {
        setFileTitles(prevTitles => {
            const newTitles = [...prevTitles];
            newTitles[index] = value;
            return newTitles;
        });
    }, []);
    





    const TextField = useCallback(({ value, onChange, index }: { value: string, onChange: (index: number, value: string) => void, index: number }) => {
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
            <div className="bg-white dark:bg-[#0C1222] p-6 shadow-lg w-full max-w-md border-dashed border-2 border-[#D5D5D5] text-black dark:text-[#D5D5D5] ">
                <div className="flex justify-between items-center mb-4">
                    <Link href={'/notes'}>
                        <button className="text-[#3BF3C7] px-2 py-2 border-2 border-[#3BF3C7] flex items-center justify-center font-bold hover:bg-[#ffffff]/10">
                            <FontAwesomeIcon icon={faArrowLeft} />
                        </button>
                    </Link>
                    <h3>New Note</h3>
                    <div className="relative group">
                        <div className="absolute inset-0 bg-black dark:bg-[#3BF4C7]" />
                        <div className="dark:absolute dark:inset-0 dark:blur-[75px] dark:lg:bg-none lg:dark:group-hover:bg-[#3BF4C7] transition dark:group-hover:duration-200 duration-1000" />
                        <button type="submit" onClick={handleSubmit} disabled={uploading} className="dark:text-[#D5D5D5] dark:group-hover:text-[#3BF4C7] dark:group-hover:border-[#3BF4C7] dark:border-[#D5D5D5] dark:bg-[#0C1222] border-black border-2 relative px-4 py-2 text-lg bg-[#3BF4C7] text-black font-bold group-hover:-translate-x-1 group-hover:-translate-y-1 transition duration-150">
                            {uploading ? "Uploading..." : "Upload"}
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

                    <div className="mb-4">
                        <div className="flex items-center mb-2 flex-wrap w-full">
                            {selectedTags.map((tag) => (
                                <span
                                    key={tag}
                                    className="inline-block bg-white dark:bg-[#3F4451] px-3 py-1 text-xs font-semibold mr-2 mb-2"
                                >
                                    #{tag}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveTag(tag)}
                                        className="ml-2 text-red-500"
                                    >
                                        &times;
                                    </button>
                                </span>
                            ))}
                            <div className="relative w-full">
                                <input
                                    type="text"
                                    placeholder="Add tag"
                                    className={`p-2 border-2 border-dashed border-gray-300 w-full dark:bg-[#0C1222] text-lg font-bold`}
                                    value={newTag}
                                    onChange={handleTagInputChange}
                                    onKeyDown={handleKeyDown}
                                    onFocus={() => setShowDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                />
                                {showDropdown && (
                                    <div ref={dropdownRef} className="absolute z-10 mt-1 w-full bg-white dark:bg-[#232530] shadow-lg max-h-60 py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                                        {filteredTags.map((tag) => (
                                            <div
                                                key={tag}
                                                className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-[#ffffff]/10"
                                                onClick={() => handleTagSelect(tag)}
                                            >
                                                {tag}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

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
                            {files.map((file, index) => (
                                <div key={index} className="text-gray-700 flex items-center text-xs w-full">
                                    <TextField
                                        value={fileTitles[index]}
                                        onChange={handleTitleChange}
                                        index={index} />
                                </div>
                            ))}
                        </div>
                    )}
                    {error && (
                        <div className="mb-4 text-center">
                            <span className="text-red-500">{error}</span>
                        </div>
                    )}

                    {message && (
                        <div className="mb-4 text-center">
                            <span className={`text-${message.includes('successfully') ? 'green' : 'red'}-500`}>{message}</span>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );

}

export default UploadFileNotes;
