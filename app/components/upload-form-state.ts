import {
  moveById,
  removeById,
  rotateClockwise,
  updateById,
  type PageRotation,
} from "@/lib/uploads/page-images";

export type UploadVariant = "Notes" | "Past Papers";

// Matches the server's batch limit: one receipt per paper or notes PDF.
export const MAX_FILES_PER_UPLOAD = 8;
export const MAX_PAGES_PER_PAPER = 60;

export type PaperDetails = {
  courseId: string | null;
  examType: string;
  slot: string;
  year: string;
  semesterVal: string;
  campusVal: string;
  hasAnswerKey: boolean;
};

export type PaperDetailsField = keyof PaperDetails;

export type ProcessedPage = {
  blob: Blob;
  width: number;
  height: number;
  thumbnail: Blob;
};

/** One photographed page. `processed` is null until the photo is encoded. */
export type PhotoPage = {
  id: string;
  name: string;
  source: Blob;
  rotation: PageRotation;
  processed: ProcessedPage | null;
};

export type PaperSource =
  | { kind: "none" }
  | { kind: "pdf"; file: File }
  | { kind: "photos"; pages: PhotoPage[] };

export type PaperDraft = {
  id: string;
  title: string;
  details: PaperDetails;
  source: PaperSource;
};

export type NoteDraft = {
  id: string;
  file: File;
  title: string;
};

export type NoteDetails = Pick<PaperDetails, "courseId" | "year" | "slot">;
export type NoteDetailsField = keyof NoteDetails;

export type UploadFormState = {
  papers: PaperDraft[];
  notes: NoteDraft[];
  noteDetails: NoteDetails;
  error: string;
};

type PaperFieldAction = {
  [Field in PaperDetailsField]: {
    type: "set_paper_field";
    paperId: string;
    field: Field;
    value: PaperDetails[Field];
  };
}[PaperDetailsField];

type NoteFieldAction = {
  [Field in NoteDetailsField]: {
    type: "set_note_field";
    field: Field;
    value: NoteDetails[Field];
  };
}[NoteDetailsField];

export type NewPdf = { id: string; file: File; title: string };
export type NewPage = { id: string; name: string; source: Blob };

export type UploadFormAction =
  | PaperFieldAction
  | NoteFieldAction
  | { type: "set_error"; error: string }
  | { type: "set_paper_title"; paperId: string; value: string }
  | { type: "add_paper"; paperId: string }
  | { type: "remove_paper"; paperId: string; replacementId: string }
  /** The first PDF goes into the paper; the rest become new papers after it with its details. */
  | { type: "attach_pdfs"; paperId: string; pdfs: NewPdf[] }
  | { type: "clear_paper_source"; paperId: string }
  | { type: "add_pages"; paperId: string; pages: NewPage[] }
  | { type: "page_processed"; paperId: string; pageId: string; processed: ProcessedPage }
  | { type: "page_failed"; paperId: string; pageId: string }
  | { type: "remove_page"; paperId: string; pageId: string }
  | { type: "move_page"; paperId: string; pageId: string; delta: number }
  | { type: "rotate_page"; paperId: string; pageId: string }
  | { type: "add_notes"; notes: NewPdf[] }
  | { type: "remove_note"; noteId: string }
  | { type: "set_note_title"; noteId: string; value: string };

export const emptyPaperDetails: PaperDetails = {
  courseId: null,
  examType: "",
  slot: "",
  year: "",
  semesterVal: "",
  campusVal: "",
  hasAnswerKey: false,
};

export function createPaper(id: string, details: PaperDetails = emptyPaperDetails): PaperDraft {
  return { id, title: "", details: { ...details }, source: { kind: "none" } };
}

export function createInitialUploadFormState(firstPaperId: string): UploadFormState {
  return {
    papers: [createPaper(firstPaperId)],
    notes: [],
    noteDetails: { courseId: null, year: "", slot: "" },
    error: "",
  };
}

export function getPaperPages(paper: PaperDraft): PhotoPage[] {
  return paper.source.kind === "photos" ? paper.source.pages : [];
}

export function isPageReady(page: PhotoPage): page is PhotoPage & { processed: ProcessedPage } {
  return page.processed !== null;
}

/** Pages still being encoded, across every paper. */
export function countProcessingPages(state: UploadFormState) {
  return state.papers.reduce(
    (total, paper) => total + getPaperPages(paper).filter((page) => !isPageReady(page)).length,
    0,
  );
}

export function isProcessingPages(state: UploadFormState) {
  return countProcessingPages(state) > 0;
}

export function findPage(state: UploadFormState, paperId: string, pageId: string) {
  const paper = state.papers.find((item) => item.id === paperId);
  return paper ? getPaperPages(paper).find((page) => page.id === pageId) ?? null : null;
}

/** How many more PDFs or papers this upload can take. */
export function remainingPaperSlots(state: UploadFormState, paperId?: string) {
  const target = state.papers.find((paper) => paper.id === paperId);
  const reusesTarget = target?.source.kind === "none" ? 1 : 0;
  return MAX_FILES_PER_UPLOAD - state.papers.length + reusesTarget;
}

export function remainingPageSlots(paper: PaperDraft) {
  if (paper.source.kind === "pdf") return 0;
  return MAX_PAGES_PER_PAPER - getPaperPages(paper).length;
}

function updatePaper(
  state: UploadFormState,
  paperId: string,
  update: (paper: PaperDraft) => PaperDraft,
): UploadFormState {
  if (!state.papers.some((paper) => paper.id === paperId)) return state;
  return { ...state, papers: updateById(state.papers, paperId, update) };
}

function updatePages(
  state: UploadFormState,
  paperId: string,
  update: (pages: PhotoPage[]) => PhotoPage[],
): UploadFormState {
  return updatePaper(state, paperId, (paper) => {
    if (paper.source.kind !== "photos") return paper;
    const pages = update(paper.source.pages);
    if (pages === paper.source.pages) return paper;
    return {
      ...paper,
      source: pages.length > 0 ? { kind: "photos", pages } : { kind: "none" },
    };
  });
}

function hasPage(state: UploadFormState, paperId: string, pageId: string) {
  return findPage(state, paperId, pageId) !== null;
}

export function uploadFormReducer(
  state: UploadFormState,
  action: UploadFormAction,
): UploadFormState {
  switch (action.type) {
    case "set_error":
      return { ...state, error: action.error };
    case "set_paper_field":
      return updatePaper(state, action.paperId, (paper) => ({
        ...paper,
        details: { ...paper.details, [action.field]: action.value },
      }));
    case "set_paper_title":
      return updatePaper(state, action.paperId, (paper) => ({ ...paper, title: action.value }));
    case "add_paper": {
      if (state.papers.length >= MAX_FILES_PER_UPLOAD) return state;
      const previous = state.papers[state.papers.length - 1];
      return {
        ...state,
        papers: [...state.papers, createPaper(action.paperId, previous?.details)],
      };
    }
    case "remove_paper": {
      const index = state.papers.findIndex((paper) => paper.id === action.paperId);
      if (index === -1) return state;
      if (state.papers.length === 1) {
        // Keep one paper on the form; keep its details for the next file.
        return { ...state, papers: [createPaper(action.replacementId, state.papers[0].details)] };
      }
      return { ...state, papers: removeById(state.papers, action.paperId) };
    }
    case "attach_pdfs": {
      const index = state.papers.findIndex((paper) => paper.id === action.paperId);
      if (index === -1 || action.pdfs.length === 0) return state;
      const target = state.papers[index];
      if (target.source.kind !== "none") return state;
      if (action.pdfs.length > remainingPaperSlots(state, target.id)) return state;

      const [first, ...rest] = action.pdfs;
      const filled: PaperDraft = {
        ...target,
        title: target.title.trim() ? target.title : first.title,
        source: { kind: "pdf", file: first.file },
      };
      const added = rest.map((pdf) => ({
        ...createPaper(pdf.id, target.details),
        title: pdf.title,
        source: { kind: "pdf", file: pdf.file } as const,
      }));
      const papers = [...state.papers];
      papers.splice(index, 1, filled, ...added);
      return { ...state, papers };
    }
    case "clear_paper_source":
      return updatePaper(state, action.paperId, (paper) =>
        paper.source.kind === "none" ? paper : { ...paper, source: { kind: "none" } },
      );
    case "add_pages": {
      if (action.pages.length === 0) return state;
      const paper = state.papers.find((item) => item.id === action.paperId);
      if (!paper || action.pages.length > remainingPageSlots(paper)) return state;
      const pages = action.pages.map((page): PhotoPage => ({
        ...page,
        rotation: 0,
        processed: null,
      }));
      return updatePaper(state, action.paperId, (current) => ({
        ...current,
        source: { kind: "photos", pages: [...getPaperPages(current), ...pages] },
      }));
    }
    case "page_processed":
      // A page removed while it was processing is gone; drop its result.
      if (!hasPage(state, action.paperId, action.pageId)) return state;
      return updatePages(state, action.paperId, (pages) =>
        updateById(pages, action.pageId, (page) => ({ ...page, processed: action.processed })),
      );
    case "page_failed":
    case "remove_page":
      if (!hasPage(state, action.paperId, action.pageId)) return state;
      return updatePages(state, action.paperId, (pages) => removeById(pages, action.pageId));
    case "move_page":
      if (!hasPage(state, action.paperId, action.pageId)) return state;
      return updatePages(state, action.paperId, (pages) => moveById(pages, action.pageId, action.delta));
    case "rotate_page":
      if (!hasPage(state, action.paperId, action.pageId)) return state;
      return updatePages(state, action.paperId, (pages) =>
        updateById(pages, action.pageId, (page) => ({ ...page, rotation: rotateClockwise(page.rotation) })),
      );
    case "set_note_field":
      return { ...state, noteDetails: { ...state.noteDetails, [action.field]: action.value } };
    case "add_notes":
      if (action.notes.length === 0) return state;
      if (state.notes.length + action.notes.length > MAX_FILES_PER_UPLOAD) return state;
      return { ...state, notes: [...state.notes, ...action.notes] };
    case "remove_note":
      return { ...state, notes: removeById(state.notes, action.noteId) };
    case "set_note_title":
      return { ...state, notes: updateById(state.notes, action.noteId, (note) => ({ ...note, title: action.value })) };
    default:
      return state;
  }
}

export const stripExtension = (filename: string) => filename.replace(/\.[^/.]+$/, "");

/** The per-result details for `POST /api/uploads`. Empty choices are sent as null. */
export function toResultDetails(details: PaperDetails) {
  return {
    courseId: details.courseId,
    examType: details.examType || null,
    slot: details.slot || null,
    year: details.year || null,
    semester: details.semesterVal || null,
    campus: details.campusVal || null,
    hasAnswerKey: details.hasAnswerKey,
  };
}

export function buildPastPaperSaveBody(papers: readonly PaperDraft[], receiptIds: readonly string[]) {
  if (papers.length !== receiptIds.length) {
    throw new Error("Each paper needs one processed file.");
  }
  return {
    variant: "Past Papers" as const,
    results: papers.map((paper, index) => ({
      receiptId: receiptIds[index],
      details: toResultDetails(paper.details),
    })),
  };
}

export function buildNotesSaveBody(noteDetails: NoteDetails, receiptIds: readonly string[]) {
  return {
    variant: "Notes" as const,
    results: receiptIds.map((receiptId) => ({ receiptId })),
    courseId: noteDetails.courseId,
    year: noteDetails.year,
    slot: noteDetails.slot,
  };
}

/** Papers that cannot be uploaded yet, with a message naming each one. */
export function getPaperProblems(papers: readonly PaperDraft[]) {
  return papers.flatMap((paper, index) => {
    const label = papers.length > 1 ? `Paper ${index + 1}` : "The paper";
    if (paper.source.kind === "none") return [`${label} has no PDF or photos yet.`];
    if (paper.source.kind === "photos" && !paper.source.pages.every(isPageReady)) {
      return [`${label} still has pages processing.`];
    }
    return [];
  });
}

// Camera captures get generated names that say nothing about the paper.
const CAPTURE_NAME = /^(scan|page)-\d+$/;

export function getPaperTitle(paper: PaperDraft, index: number) {
  const title = paper.title.trim();
  if (title) return title;
  if (paper.source.kind === "pdf") return stripExtension(paper.source.file.name);
  const firstPage = getPaperPages(paper)[0];
  if (!firstPage) return `Paper ${index + 1}`;
  const stem = stripExtension(firstPage.name);
  return CAPTURE_NAME.test(stem) ? "Scanned paper" : `${stem}-pages`;
}
