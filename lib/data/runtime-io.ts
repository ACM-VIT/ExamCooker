import { io } from "next/cache";

export function withRuntimeIo<Args extends unknown[], Result>(
    cachedFunction: (...args: Args) => Promise<Result>,
) {
    return async (...args: Args): Promise<Result> => {
        await io();
        return cachedFunction(...args);
    };
}
