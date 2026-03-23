import { NextResponse } from "next/server";
import { auth } from "@/app/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadDiagnosticFile = {
    name: string | null;
    type: string | null;
    size: number | null;
    lastModified: number | null;
};

function readString(value: unknown, maxLength = 500) {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim();
    if (!normalized) {
        return null;
    }

    return normalized.slice(0, maxLength);
}

function readNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown) {
    return typeof value === "boolean" ? value : null;
}

function readStringArray(value: unknown, maxItems = 20, maxLength = 120) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((item) => readString(item, maxLength))
        .filter((item): item is string => Boolean(item))
        .slice(0, maxItems);
}

function readFile(value: unknown): UploadDiagnosticFile | null {
    if (!value || typeof value !== "object") {
        return null;
    }

    const record = value as Record<string, unknown>;
    return {
        name: readString(record.name, 200),
        type: readString(record.type, 120),
        size: readNumber(record.size),
        lastModified: readNumber(record.lastModified),
    };
}

function readFiles(value: unknown, maxItems = 10) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map(readFile)
        .filter((file): file is UploadDiagnosticFile => Boolean(file))
        .slice(0, maxItems);
}

function readClientContext(value: unknown) {
    if (!value || typeof value !== "object") {
        return null;
    }

    const record = value as Record<string, unknown>;
    const viewport =
        record.viewport && typeof record.viewport === "object"
            ? {
                  width: readNumber((record.viewport as Record<string, unknown>).width),
                  height: readNumber((record.viewport as Record<string, unknown>).height),
                  pixelRatio: readNumber(
                      (record.viewport as Record<string, unknown>).pixelRatio
                  ),
              }
            : null;
    const connection =
        record.connection && typeof record.connection === "object"
            ? {
                  effectiveType: readString(
                      (record.connection as Record<string, unknown>).effectiveType,
                      40
                  ),
                  type: readString(
                      (record.connection as Record<string, unknown>).type,
                      40
                  ),
                  downlink: readNumber(
                      (record.connection as Record<string, unknown>).downlink
                  ),
                  rtt: readNumber((record.connection as Record<string, unknown>).rtt),
                  saveData: readBoolean(
                      (record.connection as Record<string, unknown>).saveData
                  ),
              }
            : null;

    return {
        href: readString(record.href, 500),
        online: readBoolean(record.online),
        language: readString(record.language, 40),
        userAgent: readString(record.userAgent, 500),
        deviceMemoryGb: readNumber(record.deviceMemoryGb),
        maxTouchPoints: readNumber(record.maxTouchPoints),
        viewport,
        connection,
    };
}

export async function POST(request: Request) {
    try {
        const rawBody = await request.text();
        const body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
        const session = await auth();

        const logEntry = {
            receivedAt: new Date().toISOString(),
            phase: readString(body.phase, 80),
            attemptId: readString(body.attemptId, 120),
            variant: readString(body.variant, 40),
            year: readString(body.year, 20),
            slot: readString(body.slot, 20),
            selectedTags: readStringArray(body.selectedTags),
            endpoint: readString(body.endpoint, 500),
            fileIndex: readNumber(body.fileIndex),
            fileTitle: readString(body.fileTitle, 200),
            fileCount: readNumber(body.fileCount),
            files: readFiles(body.files),
            status: readNumber(body.status),
            statusText: readString(body.statusText, 200),
            contentType: readString(body.contentType, 120),
            responseBodySnippet: readString(body.responseBodySnippet, 1000),
            resultsCount: readNumber(body.resultsCount),
            errorName: readString(body.errorName, 120),
            errorMessage: readString(body.errorMessage, 1000),
            clientLoggedAt: readString(body.clientLoggedAt, 80),
            clientContext: readClientContext(body.clientContext),
            requestUserAgent: readString(request.headers.get("user-agent"), 500),
            authUserId: readString(session?.user?.id, 120),
            authEmail: readString(session?.user?.email, 200),
            authRole: readString(session?.user?.role, 60),
        };

        const level =
            logEntry.phase?.includes("error") ||
            logEntry.phase?.includes("failed") ||
            Boolean(logEntry.errorMessage)
                ? "error"
                : "info";

        console[level]("[upload-diagnostic]", JSON.stringify(logEntry));

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[upload-diagnostic] failed to record event", error);
        return NextResponse.json(
            { ok: false, error: "Failed to record diagnostic." },
            { status: 400 }
        );
    }
}
