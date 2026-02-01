"use client";

import React, { useState } from "react";
import { Viewer, Worker, SpecialZoomLevel } from "@react-pdf-viewer/core";
import { toolbarPlugin } from "@react-pdf-viewer/toolbar";
import { zoomPlugin } from "@react-pdf-viewer/zoom";
import { pageNavigationPlugin } from "@react-pdf-viewer/page-navigation";
import type { RenderGoToPageProps } from "@react-pdf-viewer/page-navigation";
import type {
  RenderZoomInProps,
  RenderZoomOutProps,
} from "@react-pdf-viewer/zoom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronUp,
  faChevronDown,
  faMinus,
  faPlus,
  faExpand,
  faDownload,
} from "@fortawesome/free-solid-svg-icons";

// Import styles
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/toolbar/lib/styles/index.css";

const buttonClass =
  "p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed";
const workerUrl = new URL(
  "pdfjs-dist/build/pdf.worker.min.js",
  import.meta.url
).toString();

export default function PDFViewer({ fileUrl }: { fileUrl: string }) {
  const toolbarPluginInstance = toolbarPlugin();
  const zoomPluginInstance = zoomPlugin();
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const { Toolbar } = toolbarPluginInstance;
  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  const getDownloadFileName = (url: string) => {
    try {
      const { pathname } = new URL(url);
      const name = pathname.split("/").pop();
      if (!name) return "document.pdf";
      const decoded = decodeURIComponent(name);
      return decoded.toLowerCase().endsWith(".pdf")
        ? decoded
        : `${decoded}.pdf`;
    } catch {
      return "document.pdf";
    }
  };


  const handleDownload = () => {
    if (isDownloading) return;
    setIsDownloading(true);
    const fileName = getDownloadFileName(fileUrl);
    const downloadUrl = `/api/download?url=${encodeURIComponent(
      fileUrl
    )}&filename=${encodeURIComponent(fileName)}`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => setIsDownloading(false), 400);
  };

  return (
    <div
      className={`w-full h-full flex flex-col ${
        isFullScreen ? "fixed inset-0 z-50 bg-white dark:bg-gray-900" : ""
      }`}
    >
      <Worker workerUrl={workerUrl}>
        <div className="rpv-core__viewer flex flex-col h-full min-h-0">
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
                } = slots;
                return (
                  <div className="flex items-center justify-between w-full bg-white dark:bg-gray-800 p-2">
                    <div className="flex items-center space-x-2">
                      <GoToPreviousPage>
                        {(props: RenderGoToPageProps) => (
                          <button
                            onClick={props.onClick}
                            disabled={props.isDisabled}
                            className={buttonClass}
                          >
                            <FontAwesomeIcon icon={faChevronUp} />
                          </button>
                        )}
                      </GoToPreviousPage>
                      <CurrentPageInput />
                      <span className="mx-1">/</span>
                      <NumberOfPages />
                      <GoToNextPage>
                        {(props: RenderGoToPageProps) => (
                          <button
                            onClick={props.onClick}
                            disabled={props.isDisabled}
                            className={buttonClass}
                          >
                            <FontAwesomeIcon icon={faChevronDown} />
                          </button>
                        )}
                      </GoToNextPage>
                    </div>
                    <div className="flex items-center space-x-2">
                      <ZoomOut>
                        {(props: RenderZoomOutProps) => (
                          <button
                            onClick={props.onClick}
                            className={buttonClass}
                          >
                            <FontAwesomeIcon icon={faMinus} />
                          </button>
                        )}
                      </ZoomOut>
                      <ZoomIn>
                        {(props: RenderZoomInProps) => (
                          <button
                            onClick={props.onClick}
                            className={buttonClass}
                          >
                            <FontAwesomeIcon icon={faPlus} />
                          </button>
                        )}
                      </ZoomIn>
                      <button
                        onClick={toggleFullScreen}
                        className={buttonClass}
                      >
                        <FontAwesomeIcon icon={faExpand} />
                      </button>
                      <button
                        onClick={handleDownload}
                        className={buttonClass}
                        aria-label="Download PDF"
                        title="Download PDF"
                        disabled={isDownloading}
                      >
                        <FontAwesomeIcon icon={faDownload} />
                      </button>
                    </div>
                  </div>
                );
              }}
            </Toolbar>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <Viewer
              fileUrl={fileUrl}
              transformGetDocumentParams={(params) => ({
                ...params,
                disableRange: true,
                disableStream: true,
                disableAutoFetch: true,
              })}
              plugins={[
                toolbarPluginInstance,
                zoomPluginInstance,
                pageNavigationPluginInstance,
              ]}
              defaultScale={SpecialZoomLevel.PageFit}
              renderLoader={(percentages) => (
                <div className="flex items-center justify-center h-full text-sm text-gray-500 dark:text-gray-300">
                  Loading PDF… {Math.round(percentages)}%
                </div>
              )}
            />
          </div>
        </div>
      </Worker>
    </div>
  );
}
