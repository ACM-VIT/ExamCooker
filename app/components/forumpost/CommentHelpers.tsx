export function TimeHandler(isoString: string) {
    const dateObj = new Date(isoString);

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String((dateObj.getHours() > 12 ? dateObj.getHours() - 12 : dateObj.getHours())).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');
    const amOrPm = Number(dateObj.getHours()) < 12 ? 'am' : 'pm';

    return {
        year,
        month,
        day,
        hours,
        minutes,
        seconds,
        amOrPm,
    };
}

export function NumberOfComments({
    commentArray,
    count,
}: {
    commentArray?: any[] | undefined;
    count?: number;
}) {
    const total = typeof count === "number" ? count : commentArray?.length ?? 0;
    return (
        <div>
            <text className="bg-none text-base py-4 px-2">{total} Comments</text>
        </div>
    );
}
