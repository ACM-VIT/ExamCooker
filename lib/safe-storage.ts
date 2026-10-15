// Browsers that block site storage throw a SecurityError on any access to
// `window.localStorage`, including the property read itself.

export function readLocalStorage(key: string): string | null {
    if (typeof window === "undefined") return null;
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function writeLocalStorage(key: string, value: string): boolean {
    if (typeof window === "undefined") return false;
    try {
        window.localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}
