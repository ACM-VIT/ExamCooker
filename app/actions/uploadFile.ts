"use server";

import { auth } from "../auth";
import { redirect } from "next/navigation";
import {
    createUploadedResources,
    type CreateUploadedResourcesInput,
} from "@/lib/uploads/createUploadedResources";

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

    return createUploadedResources({
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
}
