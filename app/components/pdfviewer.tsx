'use client';

import React from 'react';
import { Viewer, Worker, SpecialZoomLevel } from '@react-pdf-viewer/core';
import { toolbarPlugin } from '@react-pdf-viewer/toolbar';
import { zoomPlugin } from '@react-pdf-viewer/zoom';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import { fullScreenPlugin } from '@react-pdf-viewer/full-screen';

// Import styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/toolbar/lib/styles/index.css';

const buttonClass = "p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300";

export default function PDFViewer({ fileUrl }: { fileUrl: string }) {
    const toolbarPluginInstance = toolbarPlugin();
    const zoomPluginInstance = zoomPlugin();
    const pageNavigationPluginInstance = pageNavigationPlugin();
    const fullScreenPluginInstance = fullScreenPlugin();

    const { Toolbar } = toolbarPluginInstance;

    return (
        <div className="w-full h-full flex flex-col">
            <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
                <div className="rpv-core__viewer flex flex-col h-full">
                    <div className="rpv-core__toolbar">
                        <Toolbar>
                            {(slots) => {
                                const {
                                    CurrentPageInput,
                                    GoToNextPage,
                                    GoToPreviousPage,
                                    NumberOfPages,
                                    ZoomIn,
                                    ZoomOut,
                                    EnterFullScreen,
                                } = slots;
                                return (
                                    <div className="flex items-center justify-between w-full bg-white dark:bg-gray-800 p-2">
                                        <div className="flex items-center space-x-2">
                                            <GoToPreviousPage>
                                                {(props) => (
                                                    <button {...props} className={buttonClass}>
                                                        ▲
                                                    </button>
                                                )}
                                            </GoToPreviousPage>
                                            <CurrentPageInput /><span className="mx-1">/</span><NumberOfPages />
                                            <GoToNextPage>
                                                {(props) => (
                                                    <button {...props} className={buttonClass}>
                                                        ▼
                                                    </button>
                                                )}
                                            </GoToNextPage>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <ZoomOut>
                                                {(props) => (
                                                    <button {...props} className={buttonClass}>
                                                        -
                                                    </button>
                                                )}
                                            </ZoomOut>
                                            <ZoomIn>
                                                {(props) => (
                                                    <button {...props} className={buttonClass}>
                                                        +
                                                    </button>
                                                )}
                                            </ZoomIn>
                                            <EnterFullScreen>
                                                {(props) => (
                                                    <button {...props} className={buttonClass}>
                                                        ⛶
                                                    </button>
                                                )}
                                            </EnterFullScreen>
                                        </div>
                                    </div>
                                );
                            }}
                        </Toolbar>
                    </div>
                    <div className="flex-grow overflow-auto">
                        <Viewer
                            fileUrl={fileUrl}
                            plugins={[
                                toolbarPluginInstance,
                                zoomPluginInstance,
                                pageNavigationPluginInstance,
                                fullScreenPluginInstance,
                            ]}
                            defaultScale={SpecialZoomLevel.PageFit}
                        />
                    </div>
                </div>
            </Worker>
        </div>
    );
}