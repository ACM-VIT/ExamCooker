export function withRuntimeData<Args extends unknown[], Result>(
    dataFunction: (...args: Args) => Promise<Result>,
) {
    return async (...args: Args): Promise<Result> => {
        return dataFunction(...args);
    };
}
