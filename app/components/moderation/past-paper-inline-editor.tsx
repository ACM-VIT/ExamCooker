"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePastPaperInline } from "@/app/actions/update-past-paper-inline";
import { useGuestPrompt } from "@/app/components/auth-gate";
import CoursePicker, { type CourseOption } from "@/app/components/mod/course-picker";
import PaperPicker from "@/app/components/mod/paper-picker";
import type { PaperLinkOption } from "@/app/components/mod/paper-link-types";
import EditorToggleButton from "@/app/components/moderation/editor-toggle-button";
import {
  EditorCheckbox,
  EditorSelect,
  EditorTextInput,
  FieldRow,
  FieldShell,
} from "@/app/components/moderation/editor-fields";
import ModeratorEditSheet from "@/app/components/moderation/moderator-edit-sheet";
import TagField from "@/app/components/moderation/tag-field";
import {
  areTagNameListsEqual,
  dedupeTagNames,
} from "@/app/components/moderation/tag-utils";
import { useModeratorInlineEditorOptions } from "@/app/components/moderation/use-moderator-inline-editor-options";
import { useToast } from "@/app/components/ui/use-toast";
import type { Campus, ExamType, Semester } from "@/db";
import { getPastPaperDetailPath } from "@/lib/seo";
import ResourceCorrectionTrigger from "@/app/components/corrections/resource-correction-trigger";

type PastPaperInlineEditorProps = {
  canonicalCode: string;
  initialCampus: Campus;
  initialCourseId: string | null;
  initialExamType: ExamType | null;
  initialHasAnswerKey: boolean;
  initialQuestionPaper: PaperLinkOption | null;
  initialSemester: Semester;
  initialSlot: string | null;
  initialTags: string[];
  initialTitle: string;
  initialYear: number | null;
  paperId: string;
};

type PaperDraft = {
  campus: Campus;
  courseId: string | null;
  examType: ExamType | null;
  hasAnswerKey: boolean;
  questionPaper: PaperLinkOption | null;
  semester: Semester;
  slot: string | null;
  tags: string[];
  title: string;
  year: number | null;
};

const EXAM_OPTIONS: ReadonlyArray<{ label: string; value: ExamType }> = [
  { value: "CAT_1", label: "CAT-1" },
  { value: "CAT_2", label: "CAT-2" },
  { value: "FAT", label: "FAT" },
  { value: "MODEL_CAT_1", label: "Model CAT-1" },
  { value: "MODEL_CAT_2", label: "Model CAT-2" },
  { value: "MODEL_FAT", label: "Model FAT" },
  { value: "MID", label: "Mid" },
  { value: "QUIZ", label: "Quiz" },
  { value: "CIA", label: "CIA" },
  { value: "OTHER", label: "Other" },
];

const SEMESTER_OPTIONS: ReadonlyArray<{ label: string; value: Semester }> = [
  { value: "FALL", label: "Fall" },
  { value: "WINTER", label: "Winter" },
  { value: "SUMMER", label: "Summer" },
  { value: "WEEKEND", label: "Weekend" },
  { value: "UNKNOWN", label: "Unknown" },
];

const CAMPUS_OPTIONS: ReadonlyArray<{ label: string; value: Campus }> = [
  { value: "VELLORE", label: "Vellore" },
  { value: "CHENNAI", label: "Chennai" },
  { value: "AP", label: "AP" },
  { value: "BHOPAL", label: "Bhopal" },
  { value: "BANGALORE", label: "Bangalore" },
  { value: "MAURITIUS", label: "Mauritius" },
];

function appendCourseOption(
  currentCourses: CourseOption[],
  nextCourse: CourseOption,
) {
  const existingCourseIds = new Set(currentCourses.map((course) => course.id));
  if (existingCourseIds.has(nextCourse.id)) {
    return currentCourses;
  }

  return [...currentCourses, nextCourse].sort((left, right) =>
    left.code.localeCompare(right.code),
  );
}

function arePaperDraftsEqual(left: PaperDraft, right: PaperDraft) {
  return (
    left.title.trim() === right.title.trim() &&
    left.courseId === right.courseId &&
    left.examType === right.examType &&
    left.slot === right.slot &&
    left.year === right.year &&
    left.semester === right.semester &&
    left.campus === right.campus &&
    left.hasAnswerKey === right.hasAnswerKey &&
    (left.questionPaper?.id ?? null) === (right.questionPaper?.id ?? null) &&
    areTagNameListsEqual(left.tags, right.tags)
  );
}

function buildBaseline(input: PastPaperInlineEditorProps): PaperDraft {
  return {
    campus: input.initialCampus,
    courseId: input.initialCourseId,
    examType: input.initialExamType,
    hasAnswerKey: input.initialHasAnswerKey,
    questionPaper: input.initialQuestionPaper,
    semester: input.initialSemester,
    slot: input.initialSlot,
    tags: dedupeTagNames(input.initialTags),
    title: input.initialTitle,
    year: input.initialYear,
  };
}

export default function PastPaperInlineEditor(
  props: PastPaperInlineEditorProps,
) {
  const { replace, refresh } = useRouter();
  const { toast } = useToast();
  const { session, status } = useGuestPrompt();
  const isModerator = session?.user?.role === "MODERATOR";
  const [isOpen, setIsOpen] = useState(false);
  const { courses, tags, error, isLoading, setCourses, setTags } =
    useModeratorInlineEditorOptions(isModerator && isOpen);
  const baseDraft = useMemo(() => buildBaseline(props), [props]);
  const [draft, setDraft] = useState<PaperDraft>(baseDraft);
  const [baseline, setBaseline] = useState<PaperDraft>(baseDraft);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasChanges = useMemo(
    () => !arePaperDraftsEqual(draft, baseline),
    [baseline, draft],
  );

  if (status === "loading") {
    return null;
  }

  if (!isModerator) {
    return (
      <ResourceCorrectionTrigger
        resourceId={props.paperId}
        resourceType="pastPaper"
      />
    );
  }

  const handleSave = () => {
    if (!hasChanges) {
      return;
    }

    setSaveError(null);
    startTransition(async () => {
      try {
        const nextTags = dedupeTagNames(draft.tags);
        await updatePastPaperInline({
          id: props.paperId,
          title: draft.title,
          courseId: draft.courseId,
          examType: draft.examType,
          slot: draft.slot,
          year: draft.year,
          semester: draft.semester,
          campus: draft.campus,
          hasAnswerKey: draft.hasAnswerKey,
          questionPaperId: draft.hasAnswerKey ? draft.questionPaper?.id ?? null : null,
          tags: nextTags,
        });

        const nextBaseline = {
          ...draft,
          tags: nextTags,
          title: draft.title.trim(),
        };
        setBaseline(nextBaseline);
        setDraft(nextBaseline);
        setTags((currentTags) => dedupeTagNames([...currentTags, ...nextTags]));

        const nextCourseCode =
          courses.find((course) => course.id === nextBaseline.courseId)?.code ??
          "unassigned";
        const nextPath = getPastPaperDetailPath(props.paperId, nextCourseCode);
        toast({ title: "Past paper updated" });
        if (nextCourseCode !== props.canonicalCode) {
          replace(nextPath);
        }
        refresh();
        setIsOpen(false);
      } catch (saveFailure) {
        const message =
          saveFailure instanceof Error
            ? saveFailure.message
            : "Failed to update past paper.";
        setSaveError(message);
        toast({
          title: message,
          variant: "destructive",
        });
      }
    });
  };

  const handleCancel = () => {
    setDraft(baseline);
    setSaveError(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      handleCancel();
    }
    setIsOpen(nextOpen);
  };

  return (
    <ModeratorEditSheet
      title="Edit past paper"
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      hasChanges={hasChanges}
      isSaving={isPending}
      onSave={handleSave}
      onCancel={handleCancel}
      errorMessage={saveError}
      trigger={<EditorToggleButton ariaLabel="Edit past paper" />}
    >
      {isLoading || error ? (
        <p className="border border-dashed border-black/15 bg-white px-3 py-2 text-xs text-black/55 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]/55">
          {error ?? "Loading editor options…"}
        </p>
      ) : null}

      <EditorTextInput
        label="Title"
        value={draft.title}
        onChange={(value) =>
          setDraft((currentDraft) => ({ ...currentDraft, title: value }))
        }
        placeholder="Past paper title"
      />

      <FieldShell label="Course">
        {courses.length > 0 ? (
          <CoursePicker
            courses={courses}
            value={draft.courseId}
            onChange={(courseId) =>
              setDraft((currentDraft) => ({
                ...currentDraft,
                courseId,
                questionPaper:
                  currentDraft.hasAnswerKey &&
                  currentDraft.questionPaper &&
                  currentDraft.courseId !== courseId
                    ? null
                    : currentDraft.questionPaper,
              }))
            }
            allowCreateCourse
            onCourseCreated={(courseOption) =>
              setCourses((currentCourses) =>
                appendCourseOption(currentCourses, courseOption),
              )
            }
          />
        ) : (
          <div className="border border-black/15 bg-white px-3 py-2 text-sm text-black/55 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]/55">
            {isLoading ? "Loading courses…" : "Course options unavailable."}
          </div>
        )}
      </FieldShell>

      <EditorSelect
        label="Exam type"
        value={draft.examType ?? ""}
        onChange={(value) =>
          setDraft((currentDraft) => ({
            ...currentDraft,
            examType: (value || null) as ExamType | null,
          }))
        }
        options={EXAM_OPTIONS}
        placeholder="Unspecified"
      />

      <FieldRow>
        <EditorTextInput
          label="Year"
          type="number"
          inputMode="numeric"
          min={2000}
          max={2100}
          value={draft.year !== null ? String(draft.year) : ""}
          onChange={(value) =>
            setDraft((currentDraft) => ({
              ...currentDraft,
              year: value === "" ? null : Number(value),
            }))
          }
          placeholder="2024"
        />
        <EditorTextInput
          label="Slot"
          value={draft.slot ?? ""}
          onChange={(value) => {
            const nextValue = value.toUpperCase().slice(0, 2);
            setDraft((currentDraft) => ({
              ...currentDraft,
              slot: nextValue === "" ? null : nextValue,
            }));
          }}
          placeholder="A1…G2"
        />
      </FieldRow>

      <FieldRow>
        <EditorSelect
          label="Semester"
          value={draft.semester}
          onChange={(value) =>
            setDraft((currentDraft) => ({
              ...currentDraft,
              semester: (value || "UNKNOWN") as Semester,
            }))
          }
          options={SEMESTER_OPTIONS}
        />
        <EditorSelect
          label="Campus"
          value={draft.campus}
          onChange={(value) =>
            setDraft((currentDraft) => ({
              ...currentDraft,
              campus: (value || "VELLORE") as Campus,
            }))
          }
          options={CAMPUS_OPTIONS}
        />
      </FieldRow>

      <EditorCheckbox
        label="This upload is an answer key"
        checked={draft.hasAnswerKey}
        onChange={(checked) =>
          setDraft((currentDraft) => ({
            ...currentDraft,
            hasAnswerKey: checked,
            questionPaper: checked ? currentDraft.questionPaper : null,
          }))
        }
      />

      {draft.hasAnswerKey ? (
        <FieldShell label="Linked question paper">
          <PaperPicker
            value={draft.questionPaper}
            excludePaperId={props.paperId}
            courseId={draft.courseId}
            onChange={(questionPaper) =>
              setDraft((currentDraft) => ({
                ...currentDraft,
                questionPaper,
              }))
            }
          />
        </FieldShell>
      ) : null}

      <FieldShell label="Tags">
        <TagField
          value={draft.tags}
          suggestions={tags}
          onChange={(nextTags) =>
            setDraft((currentDraft) => ({
              ...currentDraft,
              tags: nextTags,
            }))
          }
        />
      </FieldShell>
    </ModeratorEditSheet>
  );
}
