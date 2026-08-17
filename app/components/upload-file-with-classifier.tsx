"use client";

import React, { useEffect, useRef, useState } from "react";
import UploadFile from "@/app/components/upload-file";
import type { CourseOption } from "@/app/components/mod/course-picker";
import PaperMetadataAutofillPanel from "@/app/components/uploads/paper-metadata-autofill-panel";
import { isSupportedClassifierSource } from "@/app/components/uploads/paper-metadata-autofill";

type Props = {
    courses?: CourseOption[];
};

export default function UploadFileWithClassifier({ courses }: Props) {
    const rootRef = useRef<HTMLDivElement>(null);
    const [sourceFile, setSourceFile] = useState<File | null>(null);

    useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            const pastedFile = Array.from(event.clipboardData?.files ?? []).find(
                (file) => file.type.startsWith("image/"),
            );
            if (pastedFile) {
                setSourceFile((current) => current ?? pastedFile);
            }
        };

        document.addEventListener("paste", handlePaste, true);
        return () => document.removeEventListener("paste", handlePaste, true);
    }, []);

    const rememberSource = (files: FileList | File[]) => {
        const file = Array.from(files).find(isSupportedClassifierSource);
        if (file) {
            setSourceFile((current) => current ?? file);
        }
    };

    return (
        <div
            ref={rootRef}
            onChangeCapture={(event) => {
                const target = event.target;
                if (
                    target instanceof HTMLInputElement &&
                    target.type === "file" &&
                    target.files
                ) {
                    rememberSource(target.files);
                }
            }}
            onDropCapture={(event) => {
                rememberSource(event.dataTransfer.files);
            }}
            onClickCapture={(event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) return;
                const button = target.closest("button");
                const label = button?.getAttribute("aria-label") ?? "";
                if (label === "Remove all" || label.startsWith("Remove ")) {
                    setSourceFile(null);
                }
            }}
        >
            <UploadFile variant="Past Papers" courses={courses} />
            <PaperMetadataAutofillPanel
                rootRef={rootRef}
                sourceFile={sourceFile}
            />
        </div>
    );
}
