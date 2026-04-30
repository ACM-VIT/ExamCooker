"use client";

import {
    dedupeFileNames,
    ensurePdfFileName,
    ensureZipFileName,
} from "@/lib/downloads/resource-names";

export type DownloadablePdf = {
    fileUrl: string;
    fileName: string;
};

type ZipEntry = {
    fileName: string;
    blob: Blob;
};

let crcTable: Uint32Array | null = null;

function getCrcTable() {
    if (crcTable) return crcTable;

    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
        let c = n;
        for (let k = 0; k < 8; k += 1) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }

    crcTable = table;
    return table;
}

function crc32(bytes: Uint8Array) {
    const table = getCrcTable();
    let crc = 0xffffffff;

    for (let index = 0; index < bytes.length; index += 1) {
        crc = table[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(view: DataView, offset: number, value: number) {
    view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
    view.setUint32(offset, value, true);
}

function getDosDateTime(date: Date) {
    const year = Math.max(1980, date.getFullYear());

    return {
        time:
            (date.getHours() << 11) |
            (date.getMinutes() << 5) |
            Math.floor(date.getSeconds() / 2),
        date:
            ((year - 1980) << 9) |
            ((date.getMonth() + 1) << 5) |
            date.getDate(),
    };
}

function makeLocalHeader(input: {
    fileNameBytes: Uint8Array;
    crc: number;
    size: number;
    dosTime: number;
    dosDate: number;
}) {
    const bytes = new Uint8Array(30);
    const view = new DataView(bytes.buffer);

    writeUint32(view, 0, 0x04034b50);
    writeUint16(view, 4, 20);
    writeUint16(view, 6, 0x0800);
    writeUint16(view, 8, 0);
    writeUint16(view, 10, input.dosTime);
    writeUint16(view, 12, input.dosDate);
    writeUint32(view, 14, input.crc);
    writeUint32(view, 18, input.size);
    writeUint32(view, 22, input.size);
    writeUint16(view, 26, input.fileNameBytes.length);
    writeUint16(view, 28, 0);

    return bytes;
}

function makeCentralDirectoryHeader(input: {
    fileNameBytes: Uint8Array;
    crc: number;
    size: number;
    dosTime: number;
    dosDate: number;
    localHeaderOffset: number;
}) {
    const bytes = new Uint8Array(46);
    const view = new DataView(bytes.buffer);

    writeUint32(view, 0, 0x02014b50);
    writeUint16(view, 4, 20);
    writeUint16(view, 6, 20);
    writeUint16(view, 8, 0x0800);
    writeUint16(view, 10, 0);
    writeUint16(view, 12, input.dosTime);
    writeUint16(view, 14, input.dosDate);
    writeUint32(view, 16, input.crc);
    writeUint32(view, 20, input.size);
    writeUint32(view, 24, input.size);
    writeUint16(view, 28, input.fileNameBytes.length);
    writeUint16(view, 30, 0);
    writeUint16(view, 32, 0);
    writeUint16(view, 34, 0);
    writeUint16(view, 36, 0);
    writeUint32(view, 38, 0);
    writeUint32(view, 42, input.localHeaderOffset);

    return bytes;
}

function makeEndOfCentralDirectory(input: {
    entryCount: number;
    centralDirectorySize: number;
    centralDirectoryOffset: number;
}) {
    const bytes = new Uint8Array(22);
    const view = new DataView(bytes.buffer);

    writeUint32(view, 0, 0x06054b50);
    writeUint16(view, 4, 0);
    writeUint16(view, 6, 0);
    writeUint16(view, 8, input.entryCount);
    writeUint16(view, 10, input.entryCount);
    writeUint32(view, 12, input.centralDirectorySize);
    writeUint32(view, 16, input.centralDirectoryOffset);
    writeUint16(view, 20, 0);

    return bytes;
}

async function fetchPdfBlob(fileUrl: string) {
    const response = await fetch(fileUrl, { cache: "force-cache" });

    if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status}`);
    }

    return response.blob();
}

function saveBlob(blob: Blob, fileName: string) {
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
}

async function createZipBlob(entries: ZipEntry[]) {
    const encoder = new TextEncoder();
    const localParts: BlobPart[] = [];
    const centralParts: BlobPart[] = [];
    const now = new Date();
    const { time: dosTime, date: dosDate } = getDosDateTime(now);
    let offset = 0;
    let centralDirectorySize = 0;

    for (const entry of entries) {
        const fileNameBytes = encoder.encode(ensurePdfFileName(entry.fileName));
        const bytes = new Uint8Array(await entry.blob.arrayBuffer());
        const size = bytes.byteLength;
        const crc = crc32(bytes);
        const localHeader = makeLocalHeader({
            fileNameBytes,
            crc,
            size,
            dosTime,
            dosDate,
        });
        const centralHeader = makeCentralDirectoryHeader({
            fileNameBytes,
            crc,
            size,
            dosTime,
            dosDate,
            localHeaderOffset: offset,
        });

        localParts.push(localHeader, fileNameBytes, bytes);
        centralParts.push(centralHeader, fileNameBytes);

        offset += localHeader.byteLength + fileNameBytes.byteLength + size;
        centralDirectorySize += centralHeader.byteLength + fileNameBytes.byteLength;
    }

    const endOfCentralDirectory = makeEndOfCentralDirectory({
        entryCount: entries.length,
        centralDirectorySize,
        centralDirectoryOffset: offset,
    });

    return new Blob(
        [...localParts, ...centralParts, endOfCentralDirectory],
        { type: "application/zip" },
    );
}

export async function downloadPdfFile({ fileUrl, fileName }: DownloadablePdf) {
    try {
        const blob = await fetchPdfBlob(fileUrl);
        saveBlob(blob, ensurePdfFileName(fileName));
    } catch {
        const fallbackLink = document.createElement("a");
        fallbackLink.href = fileUrl;
        fallbackLink.target = "_blank";
        fallbackLink.rel = "noopener noreferrer";
        document.body.appendChild(fallbackLink);
        fallbackLink.click();
        fallbackLink.remove();
    }
}

export async function downloadPdfZip(input: {
    files: DownloadablePdf[];
    zipFileName: string;
}) {
    if (!input.files.length) return;

    const dedupedNames = dedupeFileNames(input.files.map((file) => file.fileName));
    const entries = await Promise.all(
        input.files.map(async (file, index) => ({
            fileName: dedupedNames[index],
            blob: await fetchPdfBlob(file.fileUrl),
        })),
    );

    const zipBlob = await createZipBlob(entries);
    saveBlob(zipBlob, ensureZipFileName(input.zipFileName));
}
