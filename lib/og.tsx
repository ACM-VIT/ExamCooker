import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_ALT = "ExamCooker social preview image";
export const OG_IMAGE_SIZE = {
    width: 1200,
    height: 630,
} as const;
export const OG_CONTENT_TYPE = "image/png";

type OgImageInput = {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    description?: string;
    chips?: Array<string | null | undefined>;
};

const BORDER_COLOR = "#2562E3";
const ACCENT_COLOR = "#3B92FF";
const TEXT_COLOR = "#F1F3F8";
const MUTED_TEXT_COLOR = "rgba(241,243,248,0.78)";
const SUBTLE_TEXT_COLOR = "rgba(241,243,248,0.62)";

const logoIconPromise = readFile(
    join(process.cwd(), "public", "assets", "logo-icon.svg"),
    "utf8",
).then((svg) => svgToDataUrl(svg));

function bufToArrayBuffer(buf: Buffer): ArrayBuffer {
    const ab = new ArrayBuffer(buf.length);
    new Uint8Array(ab).set(buf);
    return ab;
}

const fontBoldPromise = readFile(
    join(process.cwd(), "public", "assets", "fonts", "plus-jakarta-sans-bold.ttf"),
)
    .then(bufToArrayBuffer)
    .catch(() => null);

const fontExtraBoldPromise = readFile(
    join(process.cwd(), "public", "assets", "fonts", "plus-jakarta-sans-extra-bold.ttf"),
)
    .then(bufToArrayBuffer)
    .catch(() => null);

const illustrationDataUrl = svgToDataUrl(`
<svg width="432" height="432" viewBox="0 0 432 432" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="84" y="54" width="170" height="228" rx="18" stroke="${BORDER_COLOR}" stroke-width="8"/>
  <rect x="110" y="80" width="30" height="30" rx="3" stroke="${BORDER_COLOR}" stroke-width="7"/>
  <path d="M117 95L127 105L144 87" stroke="${BORDER_COLOR}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="168" y1="95" x2="244" y2="95" stroke="${BORDER_COLOR}" stroke-width="7" stroke-linecap="round"/>
  <line x1="168" y1="116" x2="238" y2="116" stroke="${BORDER_COLOR}" stroke-width="7" stroke-linecap="round"/>
  <rect x="110" y="140" width="30" height="30" rx="3" stroke="${BORDER_COLOR}" stroke-width="7"/>
  <path d="M117 155L127 165L144 147" stroke="${BORDER_COLOR}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="168" y1="155" x2="244" y2="155" stroke="${BORDER_COLOR}" stroke-width="7" stroke-linecap="round"/>
  <line x1="168" y1="176" x2="238" y2="176" stroke="${BORDER_COLOR}" stroke-width="7" stroke-linecap="round"/>
  <rect x="110" y="200" width="30" height="30" rx="3" stroke="${BORDER_COLOR}" stroke-width="7"/>
  <path d="M117 215L127 225L144 207" stroke="${BORDER_COLOR}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="168" y1="215" x2="244" y2="215" stroke="${BORDER_COLOR}" stroke-width="7" stroke-linecap="round"/>
  <line x1="168" y1="236" x2="238" y2="236" stroke="${BORDER_COLOR}" stroke-width="7" stroke-linecap="round"/>
  <path d="M118 278L140 236L162 278V368C162 374.627 156.627 380 150 380H130C123.373 380 118 374.627 118 368V278Z" stroke="${BORDER_COLOR}" stroke-width="8" stroke-linejoin="round"/>
  <line x1="140" y1="255" x2="140" y2="330" stroke="${BORDER_COLOR}" stroke-width="8" stroke-linecap="round"/>
  <circle cx="344" cy="150" r="66" stroke="${BORDER_COLOR}" stroke-width="8"/>
  <line x1="344" y1="110" x2="344" y2="150" stroke="${BORDER_COLOR}" stroke-width="8" stroke-linecap="round"/>
  <line x1="344" y1="150" x2="378" y2="150" stroke="${BORDER_COLOR}" stroke-width="8" stroke-linecap="round"/>
  <circle cx="344" cy="150" r="8" fill="${BORDER_COLOR}"/>
  <line x1="344" y1="92" x2="344" y2="102" stroke="${BORDER_COLOR}" stroke-width="6" stroke-linecap="round"/>
  <line x1="344" y1="198" x2="344" y2="208" stroke="${BORDER_COLOR}" stroke-width="6" stroke-linecap="round"/>
  <line x1="286" y1="150" x2="296" y2="150" stroke="${BORDER_COLOR}" stroke-width="6" stroke-linecap="round"/>
  <line x1="392" y1="150" x2="402" y2="150" stroke="${BORDER_COLOR}" stroke-width="6" stroke-linecap="round"/>
  <line x1="306" y1="112" x2="313" y2="119" stroke="${BORDER_COLOR}" stroke-width="6" stroke-linecap="round"/>
  <line x1="375" y1="181" x2="382" y2="188" stroke="${BORDER_COLOR}" stroke-width="6" stroke-linecap="round"/>
  <line x1="306" y1="188" x2="313" y2="181" stroke="${BORDER_COLOR}" stroke-width="6" stroke-linecap="round"/>
  <line x1="375" y1="119" x2="382" y2="112" stroke="${BORDER_COLOR}" stroke-width="6" stroke-linecap="round"/>
  <rect x="208" y="262" width="188" height="38" rx="19" stroke="${BORDER_COLOR}" stroke-width="8"/>
  <rect x="188" y="318" width="208" height="38" rx="19" stroke="${BORDER_COLOR}" stroke-width="8"/>
  <path d="M218 262H388C400.15 262 410 271.85 410 284C410 296.15 400.15 306 388 306H218" stroke="${BORDER_COLOR}" stroke-width="8" stroke-linecap="round"/>
  <path d="M198 318H364C376.15 318 386 327.85 386 340C386 352.15 376.15 362 364 362H198" stroke="${BORDER_COLOR}" stroke-width="8" stroke-linecap="round"/>
  <path d="M334 276V304L348 292L362 304V276" stroke="${BORDER_COLOR}" stroke-width="8" stroke-linejoin="round"/>
  <path d="M262 332V360L276 348L290 360V332" stroke="${BORDER_COLOR}" stroke-width="8" stroke-linejoin="round"/>
</svg>
`);

function svgToDataUrl(svg: string) {
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function trimText(value: string, maxLength: number) {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function pickTitleSize(title: string) {
    if (title.length > 48) return 58;
    if (title.length > 34) return 68;
    if (title.length > 22) return 78;
    return 90;
}

function normalizeChips(chips: Array<string | null | undefined>) {
    return chips
        .map((chip) => chip?.trim())
        .filter((chip): chip is string => Boolean(chip))
        .slice(0, 3)
        .map((chip) => trimText(chip, 28));
}

export function formatCountChip(label: string, count: number) {
    return `${count.toLocaleString("en-US")} ${label}`;
}

export async function renderExamCookerOgImage(input: OgImageInput) {
    const [logoIcon, fontBold, fontExtraBold] = await Promise.all([
        logoIconPromise,
        fontBoldPromise,
        fontExtraBoldPromise,
    ]);
    const title = trimText(input.title, 72);
    const subtitle = input.subtitle ? trimText(input.subtitle, 88) : "";
    const description = input.description ? trimText(input.description, 110) : "";
    const chips = normalizeChips(input.chips ?? []);
    const titleSize = pickTitleSize(title);

    return new ImageResponse(
        (
            <div
                style={{
                    display: "flex",
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    background:
                        "radial-gradient(circle at top left, rgba(53,102,231,0.18), transparent 42%), linear-gradient(180deg, #24478E 0%, #192D64 58%, #152654 100%)",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        width: "100%",
                        height: "100%",
                        padding: "46px 50px 40px",
                        justifyContent: "space-between",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            width: "58%",
                            height: "100%",
                            flexDirection: "column",
                            justifyContent: "space-between",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                maxWidth: 590,
                            }}
                        >
                            {input.eyebrow ? (
                                <div
                                    style={{
                                        display: "flex",
                                        color: ACCENT_COLOR,
                                        fontSize: 20,
                                        fontWeight: 700,
                                        letterSpacing: 2,
                                        textTransform: "uppercase",
                                    }}
                                >
                                    {trimText(input.eyebrow, 26)}
                                </div>
                            ) : null}

                            <div
                                style={{
                                    display: "flex",
                                    marginTop: input.eyebrow ? 16 : 8,
                                    fontSize: titleSize,
                                    fontWeight: 800,
                                    lineHeight: 1.05,
                                    letterSpacing: 0,
                                    color: TEXT_COLOR,
                                    whiteSpace: "pre-wrap",
                                }}
                            >
                                {title}
                            </div>

                            {subtitle ? (
                                <div
                                    style={{
                                        display: "flex",
                                        marginTop: 22,
                                        fontSize: 32,
                                        lineHeight: 1.2,
                                        color: MUTED_TEXT_COLOR,
                                        whiteSpace: "pre-wrap",
                                    }}
                                >
                                    {subtitle}
                                </div>
                            ) : null}

                            {description ? (
                                <div
                                    style={{
                                        display: "flex",
                                        marginTop: 16,
                                        fontSize: 24,
                                        lineHeight: 1.28,
                                        color: SUBTLE_TEXT_COLOR,
                                        whiteSpace: "pre-wrap",
                                    }}
                                >
                                    {description}
                                </div>
                            ) : null}

                            {chips.length ? (
                                <div
                                    style={{
                                        display: "flex",
                                        marginTop: 28,
                                        fontSize: 22,
                                        fontWeight: 600,
                                        color: SUBTLE_TEXT_COLOR,
                                        letterSpacing: 0.3,
                                    }}
                                >
                                    {chips.join("  ·  ")}
                                </div>
                            ) : null}
                        </div>

                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                alignSelf: "flex-start",
                                padding: "14px 20px",
                                border: "1px solid rgba(120, 150, 255, 0.3)",
                                borderRadius: 14,
                                background: "rgba(22, 36, 79, 0.48)",
                            }}
                        >
                            <img
                                src={logoIcon}
                                width={42}
                                height={42}
                                alt=""
                                style={{ display: "flex" }}
                            />
                            <div
                                style={{
                                    display: "flex",
                                    marginLeft: 16,
                                    fontSize: 34,
                                    fontWeight: 800,
                                    lineHeight: 1,
                                    color: TEXT_COLOR,
                                }}
                            >
                                Exam
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    fontSize: 34,
                                    fontWeight: 800,
                                    lineHeight: 1,
                                    color: ACCENT_COLOR,
                                }}
                            >
                                Cooker
                            </div>
                        </div>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            width: "38%",
                            height: "100%",
                            alignItems: "center",
                            justifyContent: "center",
                            paddingTop: 12,
                        }}
                    >
                        <img
                            src={illustrationDataUrl}
                            width={408}
                            height={408}
                            alt=""
                            style={{ display: "flex" }}
                        />
                    </div>
                </div>
            </div>
        ),
        {
            ...OG_IMAGE_SIZE,
            fonts: [
                ...(fontBold
                    ? [{ name: "Plus Jakarta Sans", data: fontBold, weight: 700 as const, style: "normal" as const }]
                    : []),
                ...(fontExtraBold
                    ? [{ name: "Plus Jakarta Sans", data: fontExtraBold, weight: 800 as const, style: "normal" as const }]
                    : []),
            ],
        },
    );
}
