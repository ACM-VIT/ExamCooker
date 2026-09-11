/**
 * Kill switch for the Code2Create promo surfaces.
 *
 * 1 = enabled, 0 = disabled. While this is 0 nothing C2C-related renders:
 * not the desktop sakura banner/dock (`app/components/c2c-sakura-signal.tsx`)
 * and not the mobile tab bar entry (`app/components/mobile-tab-bar.tsx`).
 * The components themselves are left intact so next year's edition only needs
 * this flipped back to 1, plus a refresh of the event URL and the "7.0"
 * labels/logo inside those two files.
 */
export const C2C_PROMO_ENABLED: number = 0;
