"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSyllabusInline } from "@/app/actions/update-syllabus-inline";
import { useGuestPrompt } from "@/app/components/auth-gate";
import CoursePicker, { type CourseOption } from "@/app/components/mod/course-picker";
import EditorToggleButton from "@/app/components/moderation/editor-toggle-button";
import {
  EditorTextInput,
  FieldShell,
} from "@/app/components/moderation/editor-fields";
import ModeratorEditSheet from "@/app/components/moderation/moderator-edit-sheet";
import { useModeratorInlineEditorOptions } from "@/app/components/moderation/use-moderator-inline-editor-options";
import { useToast } from "@/app/components/ui/use-toast";
import { getCourseSyllabusPath } from "@/lib/seo";

type SyllabusInlineEditorProps = {
  initialCourseCode: string | null;
  initialTitle: string;
  syllabusId: string;
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

export default function SyllabusInlineEditor({
  initialCourseCode,
  initialTitle,
  syllabusId,
}: SyllabusInlineEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { session, status } = useGuestPrompt();
  const isModerator = session?.user?.role === "MODERATOR";
  const [isOpen, setIsOpen] = useState(false);
  const { courses, error, isLoading, setCourses } =
    useModeratorInlineEditorOptions(isModerator && isOpen);
  const resolvedInitialCourseId = useMemo(
    () =>
      initialCourseCode
        ? courses.find((course) => course.code === initialCourseCode)?.id ?? null
        : null,
    [courses, initialCourseCode],
  );
  const [draftTitle, setDraftTitle] = useState(initialTitle);
  const [draftCourseId, setDraftCourseId] = useState<string | null | undefined>(
    undefined,
  );
  const [baselineTitle, setBaselineTitle] = useState(initialTitle);
  const [baselineCourseId, setBaselineCourseId] = useState<string | null | undefined>(
    undefined,
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (draftCourseId !== undefined || (courses.length === 0 && !isLoading)) {
      return;
    }

    if (courses.length === 0) {
      return;
    }

    setDraftCourseId(resolvedInitialCourseId);
    setBaselineCourseId(resolvedInitialCourseId);
  }, [courses.length, draftCourseId, isLoading, resolvedInitialCourseId]);

  if (status === "loading" || !isModerator) {
    return null;
  }

  const hasChanges =
    draftCourseId !== undefined &&
    (draftTitle.trim() !== baselineTitle.trim() ||
      draftCourseId !== baselineCourseId);

  const handleSave = () => {
    if (!hasChanges || draftCourseId === undefined) {
      return;
    }

    setSaveError(null);
    startTransition(async () => {
      try {
        const result = await updateSyllabusInline({
          id: syllabusId,
          courseId: draftCourseId,
          title: draftTitle,
        });

        setBaselineCourseId(draftCourseId);
        setBaselineTitle(result.title);
        setDraftTitle(result.title);
        toast({ title: "Syllabus updated" });

        const nextPath = result.courseCode
          ? getCourseSyllabusPath(result.courseCode)
          : `/syllabus/${syllabusId}`;
        router.replace(nextPath);
        router.refresh();
        setIsOpen(false);
      } catch (saveFailure) {
        const message =
          saveFailure instanceof Error
            ? saveFailure.message
            : "Failed to update syllabus.";
        setSaveError(message);
        toast({
          title: message,
          variant: "destructive",
        });
      }
    });
  };

  const handleCancel = () => {
    setDraftTitle(baselineTitle);
    setDraftCourseId(baselineCourseId);
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
      title="Edit syllabus"
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      hasChanges={hasChanges}
      isSaving={isPending}
      onSave={handleSave}
      onCancel={handleCancel}
      errorMessage={saveError}
      trigger={<EditorToggleButton ariaLabel="Edit syllabus" />}
    >
      {isLoading || error ? (
        <p className="border border-dashed border-black/15 bg-white px-3 py-2 text-xs text-black/55 dark:border-[#D5D5D5]/15 dark:bg-[#0C1222] dark:text-[#D5D5D5]/55">
          {error ?? "Loading editor options…"}
        </p>
      ) : null}

      <EditorTextInput
        label="Title"
        value={draftTitle}
        onChange={setDraftTitle}
        placeholder="Syllabus title"
      />

      <FieldShell label="Course">
        {courses.length > 0 && draftCourseId !== undefined ? (
          <CoursePicker
            courses={courses}
            value={draftCourseId}
            onChange={setDraftCourseId}
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
    </ModeratorEditSheet>
  );
}
