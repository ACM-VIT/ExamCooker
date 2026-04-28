"use client";

import Image from "@/app/components/common/AppImage";
import React, { useState, useTransition } from "react";
import { createComment } from "@/app/actions/CreateComment";
import { useGuestPrompt } from "@/app/components/GuestPromptProvider";
import { useToast } from "@/components/ui/use-toast";

interface AddCommentFormProps {
    forumPostId: string;
    onCommentAdded?: () => void;
}

const CommentField: React.FC<AddCommentFormProps> = ({
    forumPostId,
    onCommentAdded,
}) => {
    const [content, setContent] = useState("");
    const [pending, startTransition] = useTransition();
    const { requireAuth } = useGuestPrompt();
    const { toast } = useToast();

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!requireAuth("post comments")) {
            return;
        }
        startTransition(async () => {
            const trimmedContent = content.trim();
            if (!trimmedContent) {
                toast({ title: "Comment cannot be empty.", variant: "destructive" });
                return;
            }

            const result = await createComment({
                content: trimmedContent,
                forumPostId,
            });

            if (result.success) {
                setContent("");
                if (onCommentAdded) {
                    onCommentAdded();
                }
            } else {
                console.error("Error creating comment:", result.error);
                toast({
                    title: result.error ?? "Failed to add comment.",
                    variant: "destructive",
                });
            }
        });
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setContent(event.target.value);
    };

    return (
        <div>
            <form
                className="relative drop-shadow-md flex align-top mb-5"
                onSubmit={handleSubmit}
            >
                <input
                    type="text"
                    placeholder={pending ? "Posting comment..." : "Add a comment.."}
                    value={content}
                    className="w-full px-4 py-3 text-base placeholder-[#838383]  dark:bg-[#4F5159] focus:outline-none focus:ring-2 focus:ring-[#3BF3C7]"
                    onChange={handleInputChange}
                    disabled={pending}
                />
                <SubmitCommentButton pending={pending} />
            </form>
        </div>
    );
};

export default CommentField;

const SubmitCommentButton: React.FC<{ pending: boolean }> = ({ pending }) => {
    return (
        <button
            type="submit"
            disabled={pending}
            className="bg-white py-3 px-4 hover:bg-gray-300 dark:bg-[#4F5159] focus:outline-none focus:ring-2 focus:ring-[#3BF3C7]"
        >
            <Image
                src="/comment/SubmitComment.svg"
                alt="Submit Comment"
                width={24}
                height={24}
            />
        </button>
    );
};
