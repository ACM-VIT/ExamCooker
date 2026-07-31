import DirectionalTransition from "@/app/components/common/directional-transition";
import { CoursePastPapersHeaderShell } from "@/app/components/past_papers/course-past-papers-shell";

// Route-level fallback so navigating into a course from the search dropdown
// paints an instant skeleton instead of holding the previous page on screen
// while the server render resolves.
export default function Loading() {
    return (
        <DirectionalTransition>
            <div className="min-h-screen bg-[#C2E6EC] text-black dark:bg-[hsl(224,48%,9%)] dark:text-[#D5D5D5]">
                <CoursePastPapersHeaderShell />
            </div>
        </DirectionalTransition>
    );
}
