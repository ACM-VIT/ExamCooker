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
                                            handleRename(
                                                item.id,
                                                activeTab === "notes"
                                                    ? "note"
                                                    : "pastPaper",
                                                prompt("Enter new name:") || item.title
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
        </div>
    );
};

export default ModeratorDashboardClient;
