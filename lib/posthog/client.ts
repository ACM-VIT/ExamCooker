import posthog from "posthog-js";
import type { CaptureOptions } from "posthog-js";

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

type PostHogClient = typeof posthog & {
    __loaded?: boolean;
};

function getClient() {
    if (typeof window === "undefined") {
        return null;
    }

    const client = posthog as PostHogClient;
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
    const client = getClient();
    if (!client) {
        return;
    }

    client.capture(event, properties, options);
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
    const client = getClient();
    if (!client) {
        return;
    }

    const properties = {
        email: user.email ?? undefined,
        name: user.name ?? undefined,
        role: user.role ?? undefined,
    };

    client.identify(user.id, properties);
    client.setPersonPropertiesForFlags(properties);
}

export function resetPostHogUser() {
    const client = getClient();
    if (!client) {
        return;
    }

    client.reset();
}

export function getPostHogSessionId() {
    return getClient()?.get_session_id() ?? null;
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

    void fetch("/api/realtime/analytics", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        keepalive: true,
    }).catch(() => {
        // Analytics should never block the voice runtime.
    });
}
