"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateNoteInline } from "@/app/actions/update-note-inline";
import { useGuestPrompt } from "@/app/components/auth-gate";
import CoursePicker, { type CourseOption } from "@/app/components/mod/course-picker";
import EditorToggleButton from "@/app/components/moderation/editor-toggle-button";
import {
  EditorTextInput,
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
import ResourceCorrectionTrigger from "@/app/components/corrections/resource-correction-trigger";

type NoteInlineEditorProps = {
  initialCourseId: string | null;
  initialTags: string[];
  initialTitle: string;
  noteId: string;
};

type NoteDraft = {
  courseId: string | null;
  tags: string[];
  title: string;
};

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

export default function NoteInlineEditor({
  initialCourseId,
  initialTags,
  initialTitle,
  noteId,
}: NoteInlineEditorProps) {
  const { refresh } = useRouter();
  const { toast } = useToast();
  const { session, status } = useGuestPrompt();
  const isModerator = session?.user?.role === "MODERATOR";
  const [isOpen, setIsOpen] = useState(false);
  const { courses, tags, error, isLoading, setCourses, setTags } =
    useModeratorInlineEditorOptions(isModerator && isOpen);
  const baseDraft = useMemo<NoteDraft>(
    () => ({
      courseId: initialCourseId,
      tags: dedupeTagNames(initialTags),
      title: initialTitle,
    }),
    [initialCourseId, initialTags, initialTitle],
  );
  const [draft, setDraft] = useState<NoteDraft>(baseDraft);
  const [baseline, setBaseline] = useState<NoteDraft>(baseDraft);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasChanges = useMemo(() => {
    return (
      draft.title.trim() !== baseline.title.trim() ||
      draft.courseId !== baseline.courseId ||
      !areTagNameListsEqual(draft.tags, baseline.tags)
    );
  }, [baseline, draft]);

  if (status === "loading") {
    return null;
  }

  if (!isModerator) {
    return <ResourceCorrectionTrigger resourceId={noteId} resourceType="note" />;
  }

  const handleSave = () => {
    if (!hasChanges) {
      return;
    }

    setSaveError(null);
    startTransition(async () => {
      try {
        const nextTags = dedupeTagNames(draft.tags);
        await updateNoteInline({
          id: noteId,
          title: draft.title,
          courseId: draft.courseId,
          tags: nextTags,
        });

        const nextBaseline = {
          courseId: draft.courseId,
          tags: nextTags,
          title: draft.title.trim(),
        };
        setBaseline(nextBaseline);
        setDraft(nextBaseline);
        setTags((currentTags) => dedupeTagNames([...currentTags, ...nextTags]));
        toast({ title: "Note updated" });
        refresh();
        setIsOpen(false);
      } catch (saveFailure) {
        const message =
          saveFailure instanceof Error
            ? saveFailure.message
            : "Failed to update note.";
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
      title="Edit note"
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      hasChanges={hasChanges}
      isSaving={isPending}
      onSave={handleSave}
      onCancel={handleCancel}
      errorMessage={saveError}
      trigger={<EditorToggleButton ariaLabel="Edit note" />}
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
          setDraft((currentDraft) => ({
            ...currentDraft,
            title: value,
          }))
        }
        placeholder="Note title"
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
