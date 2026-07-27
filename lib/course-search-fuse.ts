import Fuse, { type IFuseOptions } from "fuse.js";

/**
 * Minimal shape a record needs to be fuzzy-searchable as a course. Both the
 * server-side index (`getCourseSearchIndex`) and the client-side dropdowns feed
 * records that satisfy this, so the matching behaviour stays identical wherever
 * course search happens.
 */
export type CourseFuseRecord = {
    code: string;
    title: string;
    aliases?: string[];
};

/**
 * Shared Fuse.js configuration for course search. Kept in one client-safe place
 * so the homepage dropdown, the command palette / voice index, and the notes /
 * past-papers grids all fuzzy-match with the same weights and threshold.
 */
export const COURSE_SEARCH_FUSE_OPTIONS: IFuseOptions<CourseFuseRecord> = {
    keys: [
        { name: "title", weight: 0.6 },
        { name: "code", weight: 0.3 },
        { name: "aliases", weight: 0.1 },
    ],
    threshold: 0.3,
    ignoreLocation: true,
    minMatchCharLength: 3,
};

export function createCourseFuse<T extends CourseFuseRecord>(records: T[]) {
    return new Fuse(records, COURSE_SEARCH_FUSE_OPTIONS);
}
