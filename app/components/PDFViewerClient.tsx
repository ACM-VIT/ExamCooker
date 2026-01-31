"use client";

import React from "react";
import dynamic from "next/dynamic";

const PDFViewer = dynamic(() => import("./pdfviewer"), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-300">
            Loading PDF viewer...
        </div>
    ),
});

export default function PDFViewerClient({ fileUrl }: { fileUrl: string }) {
    return <PDFViewer fileUrl={fileUrl} />;
}
