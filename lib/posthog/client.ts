import type { CaptureOptions } from "posthog-js";
import {
    getPostHogClientConfig,
    getPostHogProjectKey,
} from "@/lib/posthog/shared";
import { toRouteTemplate } from "@/lib/posthog/route-template";
import { captureVoiceRealtimeAnalyticsAction } from "@/app/components/voice/voice-agent-actions";

export type VoiceAgentEntryPoint = "nav" | "home_search";
export type CourseSearchContext = "home" | "notes" | "past_papers";
export type CourseSearchInteraction =
    | "click"
    | "keyboard"
    | "mobile_tap"
    | "submit_exact_match";
export type VoiceAgentLlmGeneration = {
    browserPath: string;
    entryPoint: VoiceAgentEntryPoint;
    errorMessage?: string | null;
    inputText: string;
    inputTokens?: number;
    latencySeconds: number;
    model: string;
    outputText?: string | null;
    outputTokens?: number;
    responseId?: string | null;
    status: string;
    stopReason?: string | null;
    timeToFirstTokenSeconds?: number;
    voiceSessionId: string;
    conversationId?: string | null;
};

type AnalyticsProperties = Record<
    string,
    string | number | boolean | null | undefined
>;

type PostHogClient = typeof import("posthog-js").default & {
    __loaded?: boolean;
};

let posthogClientPromise: Promise<PostHogClient | null> | null = null;
let loadedPostHogClient: PostHogClient | null = null;

export async function initializePostHogClient() {
    if (typeof window === "undefined") {
        return null;
    }

    const posthogKey = getPostHogProjectKey();
    if (!posthogKey) {
        return null;
    }

    if (loadedPostHogClient?.__loaded) {
        return loadedPostHogClient;
    }

    if (!posthogClientPromise) {
        posthogClientPromise = import("posthog-js")
            .then((module) => {
                const client = module.default as PostHogClient;

                if (!client.__loaded) {
                    client.init(posthogKey, getPostHogClientConfig());
                }

                loadedPostHogClient = client;
                return client;
            })
            .catch(() => {
                posthogClientPromise = null;
                return null;
            });
    }

    return posthogClientPromise;
}

function getLoadedClient() {
    if (typeof window === "undefined") {
        return null;
    }

    const client = loadedPostHogClient;
    if (!client) {
        return null;
    }

    if (!client.__loaded) {
        return null;
    }

    return client;
}

function capturePostHogEvent(
    event: string,
    properties?: AnalyticsProperties,
    options?: CaptureOptions,
) {
    void initializePostHogClient()
        .then((client) => {
            client?.capture(event, properties, options);
        })
        .catch(() => undefined);
}

function capturePostHogException(
    error: Error,
    properties?: AnalyticsProperties,
) {
    void initializePostHogClient()
        .then((client) => {
            client?.captureException(error, properties);
        })
        .catch(() => undefined);
}

function getQueryMetrics(query: string) {
    const trimmedQuery = query.trim();
    const queryTerms = trimmedQuery.split(/\s+/).filter(Boolean);

    return {
        query_length: trimmedQuery.length,
        query_word_count: queryTerms.length,
    };
}

function getSessionDurationMs(startedAt: number | null) {
    if (startedAt === null) {
        return undefined;
    }

    return Math.max(Date.now() - startedAt, 0);
}

export function identifyPostHogUser(user: {
    id: string;
    email?: string | null;
    name?: string | null;
    role?: string | null;
}) {
    const properties = {
        email: user.email ?? undefined,
        name: user.name ?? undefined,
        role: user.role ?? undefined,
    };

    void initializePostHogClient()
        .then((client) => {
            client?.identify(user.id, properties);
            client?.setPersonPropertiesForFlags(properties);
        })
        .catch(() => undefined);
}

export function resetPostHogUser() {
    void initializePostHogClient()
        .then((client) => {
            client?.reset();
        })
        .catch(() => undefined);
}

export function getPostHogSessionId() {
    return getLoadedClient()?.get_session_id() ?? null;
}

export function captureCourseSearchSubmitted(input: {
    context: CourseSearchContext;
    query: string;
    resultCount: number;
    exactMatchFound: boolean;
}) {
    capturePostHogEvent("course_search_submitted", {
        search_context: input.context,
        result_count: input.resultCount,
        exact_match_found: input.exactMatchFound,
        ...getQueryMetrics(input.query),
    });
}

export function captureCourseSearchNoResults(input: {
    context: CourseSearchContext;
    query: string;
}) {
    const trimmedQuery = input.query.trim();
    if (!trimmedQuery) return;

    // Capture the raw query so we can finally see what people search for and
    // don't find. Failed searches while typing previously fired nothing, and
    // the query text was never in the taxonomy, so the true zero-result volume
    // was undercounted.
    capturePostHogEvent("course_search_no_results", {
        search_context: input.context,
        search_query: trimmedQuery.slice(0, 200),
        ...getQueryMetrics(trimmedQuery),
    });
}

export function captureCourseSearchSelection(input: {
    context: CourseSearchContext;
    interaction: CourseSearchInteraction;
    courseCode: string;
    resultCount: number;
    resultIndex?: number;
    paperCount: number;
    noteCount: number;
    hasSyllabus: boolean;
}) {
    capturePostHogEvent("course_search_result_selected", {
        search_context: input.context,
        interaction: input.interaction,
        course_code: input.courseCode,
        result_count: input.resultCount,
        result_index: input.resultIndex,
        paper_count: input.paperCount,
        note_count: input.noteCount,
        has_syllabus: input.hasSyllabus,
    });
}

export function captureCourseSearchDestinationClicked(input: {
    context: CourseSearchContext;
    courseCode: string;
    destination: "past_papers" | "notes" | "syllabus";
}) {
    capturePostHogEvent("course_search_destination_clicked", {
        search_context: input.context,
        course_code: input.courseCode,
        destination: input.destination,
    });
}

export function captureContentViewed(input: {
    contentType: string;
    contentId: string;
    title: string;
}) {
    capturePostHogEvent("content_viewed", {
        content_type: input.contentType,
        content_id: input.contentId,
        content_title: input.title,
    });
}

export function capturePastPapersCourseViewed(courseCode: string) {
    capturePostHogEvent("past_papers_course_viewed", {
        course_code: courseCode,
    });
}

export function captureAuthPromptOpened(action?: string) {
    capturePostHogEvent("auth_prompt_opened", {
        action: action ?? "continue",
    });
}

export function captureSignInStarted(input: {
    source: string;
    callbackPath: string;
}) {
    capturePostHogEvent(
        "sign_in_started",
        {
            source: input.source,
            callback_path: input.callbackPath,
        },
        { transport: "sendBeacon" },
    );
}

export function captureUploadClick(kind: "note" | "paper") {
    capturePostHogEvent(
        kind === "note" ? "upload_note_clicked" : "upload_paper_clicked",
    );
}

export function captureSharedContent(input: {
    contentType: string;
    url?: string;
}) {
    capturePostHogEvent("content_shared", {
        content_type: input.contentType,
        url: input.url,
    });
}

export function captureResourceSourceOpened(input: {
    sourceUrl: string;
    pathname: string;
}) {
    let sourceHost: string | undefined;

    try {
        sourceHost = new URL(input.sourceUrl).host;
    } catch {
        sourceHost = undefined;
    }

    capturePostHogEvent("resource_source_opened", {
        pathname: input.pathname,
        source_host: sourceHost,
        source_url: input.sourceUrl,
    });
}

export function captureUserSignedOut() {
    capturePostHogEvent("user_signed_out", undefined, {
        transport: "sendBeacon",
    });
    resetPostHogUser();
}

export function captureVoiceAgentRequested(input: {
    entryPoint: VoiceAgentEntryPoint;
    authenticated: boolean;
}) {
    capturePostHogEvent("voice_agent_requested", {
        entry_point: input.entryPoint,
        authenticated: input.authenticated,
    });
}

export function captureVoiceAgentSessionStarted(
    entryPoint: VoiceAgentEntryPoint,
) {
    capturePostHogEvent("voice_agent_session_started", {
        entry_point: entryPoint,
    });
}

export function captureVoiceAgentSessionEnded(input: {
    entryPoint: VoiceAgentEntryPoint;
    reason: "manual" | "timeout" | "error" | "unexpected_disconnect";
    startedAt: number | null;
}) {
    capturePostHogEvent("voice_agent_session_ended", {
        entry_point: input.entryPoint,
        reason: input.reason,
        duration_ms: getSessionDurationMs(input.startedAt),
    });
}

export function captureVoiceAgentError(input: {
    entryPoint: VoiceAgentEntryPoint;
    message: string;
}) {
    capturePostHogEvent("voice_agent_error", {
        entry_point: input.entryPoint,
        error_message: input.message.slice(0, 200),
    });
}

export function captureVoiceAgentLlmGeneration(
    input: VoiceAgentLlmGeneration,
) {
    if (typeof window === "undefined" || !input.inputText.trim()) {
        return;
    }

    const payload = {
        ...input,
        posthogSessionId: getPostHogSessionId(),
    };

    void captureVoiceRealtimeAnalyticsAction(payload).catch(() => {
        // Analytics should never block the voice runtime.
    });
}

export function captureQuizStarted(input: {
    courseCode: string;
    courseName: string;
}) {
    capturePostHogEvent("quiz_started", {
        course_code: input.courseCode,
        course_name: input.courseName,
    });
}

export function captureQuizSubmitted(input: {
    courseCode: string;
    score: number;
    totalQuestions: number;
}) {
    capturePostHogEvent("quiz_submitted", {
        course_code: input.courseCode,
        score: input.score,
        total_questions: input.totalQuestions,
        percentage:
            input.totalQuestions > 0
                ? Math.round((input.score / input.totalQuestions) * 100)
                : 0,
    });
}

export type PdfPageRenderFailureReason =
    | "render_error"
    | "render_timeout"
    | "empty_blob"
    | "image_decode";

export function capturePdfPageRenderFailed(input: {
    documentId: string;
    pageIndex: number;
    reason: PdfPageRenderFailureReason;
    timeoutMs?: number;
    errorMessage?: string | null;
}) {
    const properties: AnalyticsProperties = {
        // Keep the document ID and page number for drill-down, but note they are
        // deliberately NOT part of the exception message below.
        pdf_document_id: input.documentId,
        pdf_page_index: input.pageIndex,
        pdf_page_number: input.pageIndex + 1,
        failure_reason: input.reason,
        timeout_ms: input.timeoutMs,
        error_message: input.errorMessage?.slice(0, 500),
        // Pin every page-render failure to a single Error Tracking issue. Baking
        // the concrete document ID and page number into the message previously
        // minted a brand-new issue — and a duplicate "new issue" alert — for
        // every document/page combination, so a real regression spanning many
        // documents would arrive as dozens of one-occurrence issues instead of
        // one with a true occurrence count. The `failure_reason` property keeps
        // the render_error/timeout/empty_blob/image_decode split for drill-down.
        $exception_fingerprint: "PdfPageRenderError",
    };

    // Custom event so the blank-viewer failure rate is measurable in funnels
    // and dashboards alongside the `content_viewed` event.
    capturePostHogEvent("pdf_page_render_failed", properties);

    // Also surface it as a `$exception` in Error Tracking. The render catch
    // previously only `console.error`-ed, so these failures never reached
    // PostHog and the true failure rate was invisible. The message stays free of
    // the per-document/page identifiers (they live on the properties above) so
    // the pinned fingerprint collapses all occurrences into one issue.
    const error = new Error(`PDF page render ${input.reason}`);
    error.name = "PdfPageRenderError";
    capturePostHogException(error, properties);
}

export type PdfDocumentLoadFailureReason = "load_timeout" | "load_error";

export function capturePdfDocumentLoadFailed(input: {
    documentId: string;
    reason: PdfDocumentLoadFailureReason;
    timeoutMs?: number;
    loadingProgress?: number | null;
    errorMessage?: string | null;
}) {
    const properties: AnalyticsProperties = {
        // Keep the document ID for drill-down, but note it is deliberately NOT
        // part of the exception message below.
        pdf_document_id: input.documentId,
        failure_reason: input.reason,
        timeout_ms: input.timeoutMs,
        loading_progress:
            typeof input.loadingProgress === "number"
                ? Math.round(input.loadingProgress)
                : undefined,
        error_message: input.errorMessage?.slice(0, 500),
        // Pin every document-load failure to a single Error Tracking issue,
        // mirroring the page-render path. The concrete document ID in the
        // message previously fragmented one failure class into a fresh issue —
        // and a duplicate "new issue" alert — per document.
        $exception_fingerprint: "PdfDocumentLoadError",
    };

    // Custom event so the silent "Loading PDF…" placeholder failure rate is
    // measurable alongside `content_viewed`. The document-load phase previously
    // had no timeout and emitted no telemetry, so a stalled buffer left the
    // viewer on the placeholder forever with nothing captured — the sibling of
    // `pdf_page_render_failed`, but for the load phase instead of the render one.
    capturePostHogEvent("pdf_document_load_failed", properties);

    // Also surface it as a `$exception` in Error Tracking, matching the
    // page-render failure path, so document-load stalls show up alongside
    // other client errors with the load context attached. The message stays
    // free of the per-document identifier (it lives on the properties above) so
    // the pinned fingerprint collapses all occurrences into one issue.
    const error = new Error(`PDF document load ${input.reason}`);
    error.name = "PdfDocumentLoadError";
    capturePostHogException(error, properties);
}

export function captureHydrationMismatchRecovered(input: {
    path: string;
    reactErrorNumber: number | null;
    errorMessage?: string | null;
    reloadTriggered: boolean;
}) {
    const safePath = input.path.split(/[?#]/, 1)[0] || "/";
    const routeTemplate = toRouteTemplate(safePath);
    const properties: AnalyticsProperties = {
        // Keep the full (query/fragment-stripped) path for drill-down, but note
        // it is deliberately NOT part of the exception message below.
        path: safePath,
        route: routeTemplate,
        react_error_number: input.reactErrorNumber,
        error_message: input.errorMessage?.slice(0, 500),
        reload_triggered: input.reloadTriggered,
        // Pin every hydration-recovery incident to a single Error Tracking
        // issue. Baking the concrete path (with its resource CUID) into the
        // message previously minted a brand-new issue — and a duplicate
        // "new issue" alert — for every newly visited note/paper/syllabus page.
        // A constant fingerprint also stops React #418-vs-#419 and
        // reloaded-vs-not from splitting the same underlying bug.
        $exception_fingerprint: "HydrationMismatchRecovered",
    };

    // Detection and the guarded reload happen in an inline `beforeInteractive`
    // script (see `app/layout.tsx`); this only reports the recorded incident
    // once the page is stable (after any reload has already completed), so the
    // capture never races the navigation that would otherwise drop it.

    // Custom event so hydration-driven blank viewers are measurable in funnels
    // and dashboards. The failing sessions emit no `pdf_page_render_failed`
    // (the failure never reaches the render catch) and, until now, nothing that
    // pinpointed a hydration mismatch — so the true rate was undercounted.
    capturePostHogEvent("hydration_mismatch_recovered", properties);

    // Also surface it as a `$exception` in Error Tracking so it shows up
    // alongside other client errors with the recovery context attached.
    const error = new Error(
        `Hydration mismatch recovered${
            input.reactErrorNumber ? ` (React #${input.reactErrorNumber})` : ""
        } on ${routeTemplate}${input.reloadTriggered ? " — reloaded" : ""}`,
    );
    error.name = "HydrationMismatchRecovered";
    capturePostHogException(error, properties);
}

export function capturePdfDownloaded(input: {
    fileName: string;
    fileUrl: string;
    totalPages?: number | null;
    rendered?: boolean | null;
}) {
    capturePostHogEvent("pdf_downloaded", {
        file_name: input.fileName,
        file_url: input.fileUrl,
        // A burst of downloads with `pdf_rendered: false` is the blank-viewer
        // workaround — users bailing to the raw file because nothing painted in
        // the in-app viewer. Without this flag that burst is indistinguishable
        // from happy downloads of a working viewer, so the real failure rate of
        // the core "read a past paper" flow stays invisible. `pdf_total_pages`
        // adds the paging context (e.g. a multi-page doc that rendered nothing).
        pdf_total_pages:
            typeof input.totalPages === "number" ? input.totalPages : undefined,
        pdf_rendered:
            typeof input.rendered === "boolean" ? input.rendered : undefined,
    });
}

export function captureBulkPapersDownloadStarted(input: {
    courseCode: string;
    fileCount: number;
}) {
    capturePostHogEvent("bulk_papers_download_started", {
        course_code: input.courseCode,
        file_count: input.fileCount,
    });
}

export function captureBulkPapersDownloadCompleted(input: {
    courseCode: string;
    requested: number;
    succeeded: number;
    failed: number;
}) {
    capturePostHogEvent("bulk_papers_download_completed", {
        course_code: input.courseCode,
        requested: input.requested,
        succeeded: input.succeeded,
        failed: input.failed,
        partial: input.failed > 0,
    });
}

export function captureBulkPapersDownloadFailed(input: {
    courseCode: string;
    requested: number;
    errorMessage: string;
}) {
    capturePostHogEvent("bulk_papers_download_failed", {
        course_code: input.courseCode,
        requested: input.requested,
        error_message: input.errorMessage.slice(0, 200),
    });
}
