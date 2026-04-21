export type UpsellAccent = "mint" | "blue" | "peach";

export type Upsell = {
    id: string;
    eyebrow?: string;
    title: string;
    description: string;
    cta: {
        label: string;
        href: string;
        external?: boolean;
    };
    accent?: UpsellAccent;
};

export const UPSELLS: Upsell[] = [
    {
        id: "acmvit-instagram-v1",
        eyebrow: "ACM-VIT",
        title: "Follow us on Instagram",
        description:
            "Stay in the loop with events, launches, and the people behind ExamCooker.",
        cta: {
            label: "Follow @acmvit",
            href: "https://www.instagram.com/acmvit/",
            external: true,
        },
        accent: "mint",
    },
    {
        id: "examcooker-github-v1",
        eyebrow: "Open source",
        title: "ExamCooker is built by students",
        description:
            "Spot a bug or have an idea? Star the repo or open an issue — contributions welcome.",
        cta: {
            label: "Star on GitHub",
            href: "https://github.com/ACM-VIT/ExamCooker-2024",
            external: true,
        },
        accent: "blue",
    },
];

export const UPSELL_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const UPSELL_STORAGE_KEY = "examcooker.upsellDismissals.v1";
export const UPSELL_SHOW_DELAY_MS = 2500;

type DismissalRecord = Record<string, number>;

function readDismissals(): DismissalRecord {
    if (typeof window === "undefined") return {};
    try {
        const raw = window.localStorage.getItem(UPSELL_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed as DismissalRecord;
    } catch {
        // ignore malformed storage
    }
    return {};
}

function writeDismissals(data: DismissalRecord) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(UPSELL_STORAGE_KEY, JSON.stringify(data));
    } catch {
        // storage may be unavailable; fail silently
    }
}

export function pickNextUpsell(now: number = Date.now()): Upsell | null {
    const dismissals = readDismissals();
    const eligible = UPSELLS.filter((upsell) => {
        const dismissedAt = dismissals[upsell.id];
        if (!dismissedAt) return true;
        return now - dismissedAt > UPSELL_COOLDOWN_MS;
    });

    if (eligible.length === 0) return null;

    const oldestFirst = [...eligible].sort((a, b) => {
        return (dismissals[a.id] ?? 0) - (dismissals[b.id] ?? 0);
    });

    return oldestFirst[0];
}

export function markUpsellDismissed(id: string, now: number = Date.now()) {
    const dismissals = readDismissals();
    dismissals[id] = now;
    writeDismissals(dismissals);
}
