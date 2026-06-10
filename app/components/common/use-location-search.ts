"use client";

import { useSyncExternalStore } from "react";

const LOCATION_CHANGE_EVENT = "examcooker:location-change";

type PatchedHistory = History & {
    __examcookerLocationPatched?: boolean;
};

let locationChangeQueued = false;

function getSnapshot() {
    return typeof window === "undefined" ? "" : window.location.search;
}

function getServerSnapshot() {
    return "";
}

function patchHistoryEvents() {
    if (typeof window === "undefined") return;

    const history = window.history as PatchedHistory;
    if (history.__examcookerLocationPatched) return;

    const notify = () => {
        if (locationChangeQueued) return;
        locationChangeQueued = true;

        queueMicrotask(() => {
            locationChangeQueued = false;
            window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
        });
    };
    const pushState = history.pushState.bind(history);
    const replaceState = history.replaceState.bind(history);

    history.pushState = (...args) => {
        const result = pushState(...args);
        notify();
        return result;
    };
    history.replaceState = (...args) => {
        const result = replaceState(...args);
        notify();
        return result;
    };
    history.__examcookerLocationPatched = true;
}

function subscribe(onStoreChange: () => void) {
    patchHistoryEvents();
    window.addEventListener("popstate", onStoreChange);
    window.addEventListener(LOCATION_CHANGE_EVENT, onStoreChange);

    return () => {
        window.removeEventListener("popstate", onStoreChange);
        window.removeEventListener(LOCATION_CHANGE_EVENT, onStoreChange);
    };
}

export function useLocationSearch() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
