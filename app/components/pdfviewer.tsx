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
} from "@fortawesome/free-solid-svg-icons";

// Import styles
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/toolbar/lib/styles/index.css";

const buttonClass =
  "p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300";

export default function PDFViewer({ fileUrl }: { fileUrl: string }) {
  const toolbarPluginInstance = toolbarPlugin();
  const zoomPluginInstance = zoomPlugin();
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  const { Toolbar } = toolbarPluginInstance;
  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  return (
    <div
      className={`w-full h-full flex flex-col ${
        isFullScreen ? "fixed inset-0 z-50 bg-white dark:bg-gray-900" : ""
      }`}
    >
      <Worker workerUrl="/pdf.worker.min.mjs">
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
                    </div>
                  </div>
                );
              }}
            </Toolbar>
          </div>
          <div className="flex-grow overflow-auto">
            <Viewer
              fileUrl={fileUrl}
              transformGetDocumentParams={(params) => ({
                ...params,
                disableRange: true,
                disableStream: true,
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
