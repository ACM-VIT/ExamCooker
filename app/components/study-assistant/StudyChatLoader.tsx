import { memo } from "react";

export const StudyChatLoader = memo(function StudyChatLoader({
    centered = false,
}: {
    centered?: boolean;
}) {
    return (
        <div
            className={`study-chat-loader ${centered ? "study-chat-loader--centered" : ""}`}
            data-study-loader-anchor=""
            role="status"
            aria-live="polite"
            aria-label="Assistant is thinking"
        >
            <div className="study-chat-loader__icon" aria-hidden="true">
                <span className="study-chat-loader__crest" />
                <span className="study-chat-loader__pencil study-chat-loader__pencil--a" />
                <span className="study-chat-loader__pencil study-chat-loader__pencil--b" />
            </div>
        </div>
    );
});
