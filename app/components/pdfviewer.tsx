import React from 'react';

interface PdfViewerProps {
    fileUrl: string | undefined;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ fileUrl }) => {
    return (
        <div className="bg-[#C2E6EC]">
            <embed className="mx-auto h-[88vh] w-[90vh]" src={fileUrl} type="application/pdf" />
        </div>
    );
};

export default PdfViewer;