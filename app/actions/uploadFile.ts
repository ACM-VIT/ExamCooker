"use server";

import { auth } from "../auth";
import { redirect } from "next/navigation";
import {
    createUploadedResources,
    type CreateUploadedResourcesInput,
} from "@/lib/uploads/createUploadedResources";
import { createPostHogServer } from "@/lib/posthog-server";

async function captureUploadServerEvent(input: {
    distinctId: string;
    event: string;
    properties: Record<string, string | number | boolean | null | undefined>;
}) {
    const posthog = createPostHogServer();
    if (!posthog) {
        return;
    }

    posthog.capture({
        distinctId: input.distinctId,
        event: input.event,
        properties: input.properties,
    });
    await posthog.shutdown();
}

export default async function uploadFile({
    results,
    year,
    slot,
    variant,
    courseId,
    examType,
    semester,
    campus,
    hasAnswerKey,
}: Omit<CreateUploadedResourcesInput, "userEmail">) {
    const session = await auth();
    if (!session || !session.user) {
        redirect("/landing");
    }

    if (!session.user.email) {
        throw new Error("Authenticated user is missing an email address");
    }

    let uploadResult: Awaited<ReturnType<typeof createUploadedResources>>;

    try {
        uploadResult = await createUploadedResources({
            userEmail: session.user.email,
            results,
            year,
            slot,
            variant,
            courseId,
            examType,
            semester,
            campus,
            hasAnswerKey,
        });
    } catch (error) {
        if (session.user.id) {
            await captureUploadServerEvent({
                distinctId: session.user.id,
                event: "resource_upload_failed",
                properties: {
                    course_id: courseId,
                    exam_type: examType,
                    year,
                    slot,
                    has_answer_key: hasAnswerKey,
                    file_count: results.length,
                    variant,
                    error_message:
                        error instanceof Error ? error.message.slice(0, 200) : "Unknown error",
                },
            });
        }

        throw error;
    }

    if (!uploadResult.success && session.user.id) {
        await captureUploadServerEvent({
            distinctId: session.user.id,
            event: "resource_upload_failed",
            properties: {
                course_id: courseId,
                exam_type: examType,
                year,
                slot,
                has_answer_key: hasAnswerKey,
                file_count: results.length,
                variant,
                error_message: uploadResult.error.slice(0, 200),
            },
        });
    }

    if (uploadResult.success && session.user.id) {
        await captureUploadServerEvent({
            distinctId: session.user.id,
            event: "paper_upload_completed",
            properties: {
                course_id: courseId,
                exam_type: examType,
                year,
                slot,
                has_answer_key: hasAnswerKey,
                file_count: results.length,
                variant,
            },
        });
    }

    return uploadResult;
}
