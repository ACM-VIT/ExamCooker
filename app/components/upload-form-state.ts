export type UploadVariant = "Notes" | "Past Papers";

export type UploadMetadata = {
  year: string;
  slot: string;
  courseId: string | null;
  examType: string;
  semesterVal: string;
  campusVal: string;
  hasAnswerKey: boolean;
};

export type UploadMetadataField = keyof UploadMetadata;

/**
 * Files and titles always have the same length. In image-bundle mode there is
 * exactly one file: the PDF built from `imageBundleFiles`. While a conversion
 * runs (`conversionId !== null`) the file list is locked, so the result can
 * never overwrite a removal or a PDF added in the meantime.
 */
export type UploadFormState = UploadMetadata & {
  fileTitles: string[];
  files: File[];
  imageBundleFiles: File[];
  isImageBundleMode: boolean;
  conversionId: number | null;
  isDragging: boolean;
  error: string;
};

export type UploadFormAction =
  | { [Field in UploadMetadataField]: { type: "set_field"; field: Field; value: UploadMetadata[Field] } }[UploadMetadataField]
  | { type: "set_dragging"; value: boolean }
  | { type: "set_error"; error: string }
  | { type: "update_title"; index: number; value: string }
  | { type: "add_pdfs"; files: File[]; titles: string[] }
  | { type: "remove_file"; index: number; variant: UploadVariant }
  | { type: "conversion_started"; conversionId: number }
  | { type: "conversion_succeeded"; conversionId: number; images: File[]; pdf: File; fallbackTitle: string }
  | { type: "conversion_failed"; conversionId: number };

export const initialUploadFormState: UploadFormState = {
  fileTitles: [],
  year: "",
  slot: "",
  courseId: null,
  examType: "",
  semesterVal: "",
  campusVal: "",
  hasAnswerKey: false,
  files: [],
  imageBundleFiles: [],
  isImageBundleMode: false,
  conversionId: null,
  isDragging: false,
  error: "",
};

export function isConvertingImages(state: UploadFormState) {
  return state.conversionId !== null;
}

export function uploadFormReducer(
  state: UploadFormState,
  action: UploadFormAction,
): UploadFormState {
  switch (action.type) {
    case "set_field":
      return { ...state, [action.field]: action.value };
    case "set_dragging":
      return state.isDragging === action.value ? state : { ...state, isDragging: action.value };
    case "set_error":
      return { ...state, error: action.error };
    case "update_title": {
      if (action.index < 0 || action.index >= state.files.length) return state;
      const fileTitles = [...state.fileTitles];
      fileTitles[action.index] = action.value;
      return { ...state, fileTitles };
    }
    case "add_pdfs":
      if (isConvertingImages(state) || state.isImageBundleMode) return state;
      if (action.files.length !== action.titles.length) return state;
      return {
        ...state,
        files: [...state.files, ...action.files],
        fileTitles: [...state.fileTitles, ...action.titles],
      };
    case "remove_file": {
      if (isConvertingImages(state)) return state;
      if (action.index < 0 || action.index >= state.files.length) return state;
      const files = state.files.filter((_, index) => index !== action.index);
      const fileTitles = state.fileTitles.filter((_, index) => index !== action.index);
      const clearsBundle = action.variant === "Past Papers" && files.length === 0;
      return {
        ...state,
        files,
        fileTitles,
        ...(clearsBundle ? { imageBundleFiles: [], isImageBundleMode: false } : {}),
      };
    }
    case "conversion_started":
      if (isConvertingImages(state)) return state;
      if (state.files.length > 0 && !state.isImageBundleMode) return state;
      return { ...state, conversionId: action.conversionId };
    case "conversion_succeeded":
      if (state.conversionId !== action.conversionId) return state;
      if (!state.imageBundleFiles.every((file, index) => action.images[index] === file)) {
        // The bundle no longer matches what was converted; drop the stale result.
        return { ...state, conversionId: null };
      }
      return {
        ...state,
        conversionId: null,
        imageBundleFiles: action.images,
        isImageBundleMode: true,
        files: [action.pdf],
        // Read the title now, not when the conversion started, so a title typed
        // while pages were processing is kept.
        fileTitles: [state.fileTitles[0]?.trim() || action.fallbackTitle],
      };
    case "conversion_failed":
      if (state.conversionId !== action.conversionId) return state;
      return { ...state, conversionId: null };
    default:
      return state;
  }
}
