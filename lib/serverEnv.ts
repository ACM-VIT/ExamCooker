export function hasDatabaseUrl() {
    return Boolean(process.env.DATABASE_URL?.trim());
}

export function hasGoogleAuthConfig() {
    return Boolean(
        process.env.AUTH_GOOGLE_ID?.trim() && process.env.AUTH_GOOGLE_SECRET?.trim()
    );
}

export function isAuthConfigured() {
    return hasDatabaseUrl() && hasGoogleAuthConfig();
}
