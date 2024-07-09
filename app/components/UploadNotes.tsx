"use client"
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useDropzone } from 'react-dropzone';
import { generateSignedUploadURL, storeFileInfoInDatabase } from "../actions/uploadFile";
import cuid from 'cuid';
import Fuse from 'fuse.js';
import { getTags } from '../actions/fetchTags';

const UploadFileNotes: React.FC = () => {
    const [title, setTitle] = useState('');
    const [year, setYear] = useState('');
    const [slot, setSlot] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [availableTags, setAvailableTags] = useState<string[]>([]);
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
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [tagsLoaded, setTagsLoaded] = useState(false);
    const years = ['2020', '2021', '2022', '2023', '2024'];
    const slots = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', 'E1', 'E2', 'F1', 'F2', 'G1', 'G2'];


    const filterYearAndSlot = (tags: string[], years: string[], slots: string[]) => {
        const yearRegex = /^(2\d{3}|3000)$/;
        return tags.filter(tag => !yearRegex.test(tag) && !slots.includes(tag));
    };

    useEffect(() => {
        async function fetchTags() {
            try {
                const fetchedTags = await getTags()
                const filteredTags = filterYearAndSlot(fetchedTags, years, slots);
                setAvailableTags(filteredTags)
                setFilteredTags(filteredTags)
                setTagsLoaded(true)
            } catch (error) {
                console.error('Error fetching tags:', error)
            }
        }
        fetchTags()
    }, [])
    useEffect(() => {
        if (tagsLoaded) {
            console.log("Available tags:", availableTags)
        }
    }, [availableTags, tagsLoaded])
    const fuse = useMemo(() => new Fuse(availableTags, {
        threshold: 0.6,
        minMatchCharLength: 2,
    }), [availableTags]);

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

    const handleAddTagClick = () => {
        setIsAddingTag(true);
        setShowDropdown(true);
        setFilteredTags(availableTags);
    };

    const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setNewTag(value);
        setShowDropdown(true);
        if (value) {
            const results = fuse.search(value);
            const filteredResults = filterYearAndSlot(results.map(result => result.item), years, slots);
            setFilteredTags(filteredResults);
        } else {
            setFilteredTags(filterYearAndSlot(availableTags, years, slots));
        }
    };

    const handleTagSelect = (tag: string) => {
        if (!selectedTags.includes(tag)) {
            setSelectedTags([...selectedTags, tag]);
        }
        setNewTag('');
        setIsAddingTag(false);
        setShowDropdown(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (newTag && !selectedTags.includes(newTag)) {
                setSelectedTags([...selectedTags, newTag]);
                if (!availableTags.includes(newTag)) {
                    setAvailableTags([...availableTags, newTag]);
                }
                setNewTag('');
                setIsAddingTag(false);
                setShowDropdown(false);
            }
        }
    };

    const handleRemoveTag = (tag: string) => {
        setSelectedTags(selectedTags.filter(t => t !== tag));
    };
    const onDrop = useCallback((acceptedFiles: File[]) => {
        setFiles([...files, ...acceptedFiles]);
    }, [files]);

    const { getRootProps, getInputProps } = useDropzone({
        onDrop: (acceptedFiles: File[]) => {
            setFiles([...files, ...acceptedFiles]);
            setIsDragging(false);
        },
        onDragEnter: () => setIsDragging(true),
        onDragLeave: () => setIsDragging(false),
        multiple: true
    });


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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
            setTitle('');
        }
    };

    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-100">
            <div className="bg-white p-6 shadow-lg w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <Link href={'/notes'}>
                        <button className="text-[#3BF3C7] px-2 py-1 border-2 border-[#3BF3C7] flex items-center justify-center font-bold hover:bg-teal-600">
                            <span className="mr-0">&larr;</span>
                        </button>
                    </Link>
                    <button
                        className="bg-teal-400 hover:bg-teal-500 text-black px-4 py-2 border-2 border-black font-bold"
                        onClick={handleSubmit}
                        disabled={uploading}
                    >
                        {uploading ? "Uploading..." : "Upload"}
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <input
                            type="text"
                            placeholder="Title"
                            className={`p-2 border ${title ? 'border-solid' : 'border-dotted'} border-gray-300 w-full text-black text-lg font-bold`}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <select
                                className="p-2 w-full text-black bg-blue-400 cursor-pointer transition-colors duration-300 hover:bg-blue-600"
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
                                className="p-2 w-2/3 text-black bg-blue-400 cursor-pointer transition-colors duration-300 hover:bg-blue-600"
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
                        <div className="flex items-center mb-2 flex-wrap">
                            {selectedTags.map((tag) => (
                                <span
                                    key={tag}
                                    className="inline-block text-gray-700 px-3 py-1 text-sm font-semibold mr-2 mb-2"
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
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Add tag"
                                    className={`p-2 border ${newTag ? 'border-solid' : 'border-dotted'} border-gray-300 w-full text-black text-lg font-bold`}
                                    value={newTag}
                                    onChange={handleTagInputChange}
                                    onKeyDown={handleKeyDown}
                                    onFocus={() => setShowDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                />
                                {showDropdown && (
                                    <div ref={dropdownRef} className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                                        {filteredTags.map((tag) => (
                                            <div
                                                key={tag}
                                                className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100"
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
                        <div className="mb-4">
                            {files.map((file, index) => (
                                <div key={index} className="text-gray-700 flex items-center">
                                    {file.name}
                                    <span className={`ml-2 ${fileUploadStatus[file.name] === "Uploading" ? "text-yellow-500" : "text-green-500"}`}>
                                        {fileUploadStatus[file.name]}
                                    </span>
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