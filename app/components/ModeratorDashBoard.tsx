"use client";

import React, { useState } from "react";
import { Note, PastPaper } from "@/src/generated/prisma";
import Pagination from "./Pagination";
import NotesCard from "./NotesCard";
import PastPaperCard from "./PastPaperCard";
import {approveItem, deleteItem, renameItem} from "../actions/moderatorActions";

const PAGE_SIZE = 9;

type NoteWithoutTags = Omit<Note, "tags">;
type PastPaperWithoutTags = Omit<PastPaper, "tags">;

type ModeratorDashboardClientProps = {
    initialNotes: NoteWithoutTags[];
    initialPastPapers: PastPaperWithoutTags[];
    searchParams: { page?: string; search?: string; tags?: string | string[] };
    totalUsers: number;
};

function validatePage(page: number, totalPages: number): number {
    if (isNaN(page) || page < 1) {
        return 1;
    }
    if (page > totalPages && totalPages > 0) {
        return totalPages;
    }
    return page;
}

const ModeratorDashboardClient: React.FC<ModeratorDashboardClientProps> = ({
    initialNotes,
    initialPastPapers,
    searchParams,
    totalUsers,
}) => {
    const [notes, setNotes] = useState<NoteWithoutTags[]>(initialNotes);
    const [pastPapers, setPastPapers] =
        useState<PastPaperWithoutTags[]>(initialPastPapers);
    const [activeTab, setActiveTab] = useState<"notes" | "past_papers">(
        "notes"
    );
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [renameDialog, setRenameDialog] = useState<{
        isOpen: boolean;
        id?: string;
        type?: "note" | "pastPaper";
        value: string;
    }>({ isOpen: false, value: "" });

    const page = parseInt(searchParams.page || "1", 10);

    const items = activeTab === "notes" ? notes : pastPapers;

    const totalCount = items.length;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    const validatedPage = validatePage(page, totalPages);

    const startIndex = (validatedPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const paginatedItems = items.slice(startIndex, endIndex);

    const handleApprove = async (id: string, type: "note" | "pastPaper") => {
        try {
            await approveItem(id, type);
            if (type === "note") {
                setNotes(notes.filter((note) => note.id !== id));
            } else {
                setPastPapers(pastPapers.filter((paper) => paper.id !== id));
            }
            setSelectedItems(selectedItems.filter((item) => item !== id));
        } catch (error) {
            console.error("Error approving item:", error);
        }
    };

    const handleRename = async (id: string, type: "note" | "pastPaper", newName: string) => {
        try {
            await renameItem(id, type, newName);
            if (type === "note") {
                setNotes(notes.map((note) => note.id === id ? {...note, title: newName} : note));
            } else {
                setPastPapers(pastPapers.map((paper) => paper.id === id ? {...paper, title: newName} : paper));
            }
        } catch (error) {
            console.error("Error renaming item:", error);
        }
    };

    const handleDelete = async (id: string, type: "note" | "pastPaper") => {
        try {
            await deleteItem(id, type);
            type === "note"
                ? setNotes(notes.filter((note) => note.id !== id))
                : setPastPapers(pastPapers.filter((paper) => paper.id !== id));

            setSelectedItems(selectedItems.filter((item) => item !== id));
        } catch (error) {
            console.error("Error deletign item:", error);
        }
    };

    const handleBulkApprove = async () => {
        for (const id of selectedItems) {
            await handleApprove(
                id,
                activeTab === "notes" ? "note" : "pastPaper"
            );
        }
        setSelectedItems([]);
    };

    const handleBulkDelete = async () => {
        for (const id of selectedItems) {
            await handleDelete(
                id,
                activeTab === "notes" ? "note" : "pastPaper"
            );
        }
    };

    const toggleItemSelection = (id: string) => {
        setSelectedItems((prev) =>
            prev.includes(id)
                ? prev.filter((item) => item !== id)
                : [...prev, id]
        );
    };

    const openRenameDialog = (id: string, type: "note" | "pastPaper", currentTitle: string) => {
        setRenameDialog({
            isOpen: true,
            id,
            type,
            value: currentTitle,
        });
    };

    const closeRenameDialog = () => {
        setRenameDialog({ isOpen: false, value: "" });
    };

    const submitRename = async () => {
        if (!renameDialog.id || !renameDialog.type) {
            closeRenameDialog();
            return;
        }
        const trimmed = renameDialog.value.trim();
        if (!trimmed) {
            closeRenameDialog();
            return;
        }
        await handleRename(renameDialog.id, renameDialog.type, trimmed);
        closeRenameDialog();
    };

    return (
        <div className="p-8 transition-colors flex flex-col min-h-screen items-center text-black dark:text-[#D5D5D5]">
            <h1 className="text-center mb-4  font-bold">Moderator Dashboard</h1>
            <h3>Total Users: {totalUsers}</h3>
            <br />
            <div className="w-full flex justify-center mb-6">
                <button
                    className={`mr-2 px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ease-in-out
                        ${
                            activeTab === "notes"
                                ? "bg-blue-500 text-white shadow-md"
                                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                    onClick={() => setActiveTab("notes")}
                >
                    Notes
                </button>
                <button
                    className={`ml-2 px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ease-in-out
                        ${
                            activeTab === "past_papers"
                                ? "bg-blue-500 text-white shadow-md"
                                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                    onClick={() => setActiveTab("past_papers")}
                >
                    Past Papers
                </button>
            </div>

            {selectedItems.length > 0 && (
                <button
                    className="mb-4 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
                    onClick={handleBulkApprove}
                >
                    Approve Selected ({selectedItems.length})
                </button>
            )}

            {selectedItems.length > 0 && (
                <button
                    className="mb-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
                    onClick={handleBulkDelete}
                >
                    Delete Selected ({selectedItems.length})
                </button>
            )}

            <div className="flex justify-center">
                <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 p-6 place-content-center">
                    {paginatedItems.length > 0 ? (
                        paginatedItems.map((item, index) => (
                            <div key={item.id} className="relative group">
                                <input
                                    type="checkbox"
                                    className="absolute top-2 left-2 z-10"
                                    checked={selectedItems.includes(item.id)}
                                    onChange={() =>
                                        toggleItemSelection(item.id)
                                    }
                                />
                                {activeTab === "notes" ? (
                                    <NotesCard
                                        note={item as NoteWithoutTags}
                                        index={index}
                                        openInNewTab={true}
                                    />
                                ) : (
                                    <PastPaperCard
                                        pastPaper={item as PastPaperWithoutTags}
                                        index={index}
                                        openInNewTab={true}
                                    />
                                )}
                                <div className="flex gap-2 absolute top-2 right-2">
                                    <button
                                        className="bg-green-500 text-white px-3 py-1 rounded-md 
                                                opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out
                                                hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
                                        onClick={() =>
                                            openRenameDialog(
                                                item.id,
                                                activeTab === "notes"
                                                    ? "note"
                                                    : "pastPaper",
                                                item.title
                                            )
                                        }
                                    >
                                        Rename
                                    </button>
                                    <button
                                        className="bg-green-500 text-white px-3 py-1 rounded-md
                                                opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out
                                                hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
                                        onClick={() =>
                                            handleApprove(
                                                item.id,
                                                activeTab === "notes"
                                                    ? "note"
                                                    : "pastPaper"
                                            )
                                        }
                                    >
                                        Approve
                                    </button>
                                    <button
                                        className="bg-red-500 text-white px-3 py-1 rounded-md 
                                                opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out
                                                hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
                                        onClick={() =>
                                            handleDelete(
                                                item.id,
                                                activeTab === "notes"
                                                    ? "note"
                                                    : "pastPaper"
                                            )
                                        }
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="col-span-3 text-center text-gray-500 italic">
                            No {activeTab === "notes" ? "notes" : "past papers"}{" "}
                            found.
                        </p>
                    )}
                </div>
            </div>

            {totalPages > 1 && (
                <div className="mt-auto">
                    <Pagination
                        currentPage={validatedPage}
                        totalPages={totalPages}
                        basePath="/mod"
                    />
                </div>
            )}

            {renameDialog.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center">
                    <button
                        type="button"
                        onClick={closeRenameDialog}
                        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
                        aria-label="Close rename dialog"
                    />
                    <div className="relative w-[92%] max-w-lg rounded-xl border-2 border-black dark:border-[#D5D5D5] bg-[#C2E6EC] dark:bg-[#0C1222] shadow-[10px_10px_0_rgba(0,0,0,0.2)] p-6">
                        <div className="flex items-start justify-between gap-3">
                            <h3 className="text-xl font-bold text-black dark:text-[#D5D5D5]">
                                Rename item
                            </h3>
                            <button
                                type="button"
                                onClick={closeRenameDialog}
                                className="border border-black/30 dark:border-[#D5D5D5]/40 text-xs font-semibold px-2 py-1 hover:bg-white/40 dark:hover:bg-white/5 transition text-black dark:text-[#D5D5D5]"
                            >
                                Close
                            </button>
                        </div>
                        <div className="mt-4">
                            <label className="text-sm text-black/70 dark:text-[#D5D5D5]/80">
                                New name
                            </label>
                            <input
                                type="text"
                                value={renameDialog.value}
                                onChange={(event) =>
                                    setRenameDialog((prev) => ({
                                        ...prev,
                                        value: event.target.value,
                                    }))
                                }
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        submitRename();
                                    }
                                }}
                                className="mt-2 w-full rounded-md border border-black/30 dark:border-[#D5D5D5]/40 bg-white dark:bg-[#0C1222] px-3 py-2 text-black dark:text-[#D5D5D5] focus:outline-none focus:ring-2 focus:ring-[#5FC4E7]"
                                autoFocus
                            />
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeRenameDialog}
                                className="px-4 py-2 border border-black/30 dark:border-[#D5D5D5]/40 text-sm font-semibold text-black dark:text-[#D5D5D5] hover:bg-white/40 dark:hover:bg-white/5 transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={submitRename}
                                className="px-4 py-2 bg-[#5FC4E7] text-black font-semibold border-2 border-black hover:translate-x-[-2px] hover:translate-y-[-2px] transition"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModeratorDashboardClient;
