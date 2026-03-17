"use client";

import React, {
    startTransition,
    useEffect,
    useState,
} from "react";

const loadingState = (
    <div className="h-full w-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-300">
        Loading PDF viewer...
    </div>
);

type PdfViewerComponent = React.ComponentType<{ fileUrl: string }>;

export default function PDFViewerClient({ fileUrl }: { fileUrl: string }) {
    const [ViewerComponent, setViewerComponent] =
        useState<PdfViewerComponent | null>(null);
    const [hasImportFailed, setHasImportFailed] = useState(false);

    useEffect(() => {
        let isActive = true;

        import("./pdfviewer")
            .then((module) => {
                if (!isActive) return;

                startTransition(() => {
                    setViewerComponent(() => module.default);
                    setHasImportFailed(false);
                });
            })
            .catch(() => {
                if (!isActive) return;
                setHasImportFailed(true);
            });

        return () => {
            isActive = false;
        };
    }, []);

    if (ViewerComponent) {
        return <ViewerComponent key={fileUrl} fileUrl={fileUrl} />;
    }

    if (hasImportFailed) {
        return (
            <iframe
                key={fileUrl}
                src={fileUrl}
                title="PDF preview"
                className="h-full w-full border-0 bg-white dark:bg-gray-900"
            />
        );
    }

    return loadingState;
}
