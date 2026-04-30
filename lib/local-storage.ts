export function setLocalStorage<T>(key: string, value: T) {
    if (typeof window !== "undefined") {
        localStorage.setItem(key, JSON.stringify(value));
    }
}

export function getLocalStorage<T>(key: string): T | null {
    if (typeof window === "undefined") {
        return null;
    }

    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
}
