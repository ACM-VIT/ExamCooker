export type CommandActionKind = "route" | "event" | "auth";
export type CommandSurfaceAccess = "public" | "authenticated" | "moderator";

export type CommandActionCapability = {
  id: string;
  kind: CommandActionKind;
  title: string;
  description: string;
  keywords: readonly string[];
  tone: string;
  section?: string;
  access?: CommandSurfaceAccess;
  href?: string;
  eventName?: string;
  eventDetail?: Record<string, string>;
  authAction?: "signOut";
  requiredFeature?: "voiceAgent";
};

export type CommandSurfacePage = {
  id: string;
  title: string;
  href: string;
  description: string;
  keywords: readonly string[];
  section: string;
  access: CommandSurfaceAccess;
};

export type CommandRouteTemplate = {
  id: string;
  title: string;
  hrefPattern: string;
  description: string;
  keywords: readonly string[];
  section: string;
  access: CommandSurfaceAccess;
};

export type CommandSurfaceContext = {
  query: string;
  currentPath?: string | null;
  authenticated?: boolean | null;
  role?: "user" | "moderator" | null;
  voiceAgentEnabled?: boolean | null;
};

export type CommandSurface = {
  userContext: {
    query: string;
    currentPath: string | null;
    authenticated: boolean | null;
    role: "user" | "moderator" | null;
    voiceAgentEnabled: boolean | null;
  };
  pages: CommandSurfacePage[];
  routeTemplates: CommandRouteTemplate[];
  capabilities: CommandActionCapability[];
  guidance: string[];
};

export type CommandGeneratedAction = {
  capabilityId: string;
  title: string;
  meta: string;
  tone: string;
  confidence: "high" | "medium" | "low";
};

export const COMMAND_SURFACE_PAGES = [
  {
    id: "home",
    title: "Home",
    href: "/home",
    description: "Main study dashboard and course search.",
    keywords: ["home", "dashboard", "course search", "start", "main"],
    section: "Navigate",
    access: "public",
  },
  {
    id: "past-papers",
    title: "Past papers",
    href: "/past_papers",
    description: "Browse previous exam papers by course or exam type.",
    keywords: ["past papers", "papers", "pyq", "question papers", "exams"],
    section: "Papers",
    access: "public",
  },
  {
    id: "notes",
    title: "Notes",
    href: "/notes",
    description: "Browse course notes and study material.",
    keywords: ["notes", "study material", "course notes", "lecture notes"],
    section: "Notes",
    access: "public",
  },
  {
    id: "syllabus",
    title: "Syllabus",
    href: "/syllabus",
    description: "Browse syllabus PDFs and course outlines.",
    keywords: ["syllabus", "syllabi", "course outline", "curriculum"],
    section: "Syllabus",
    access: "public",
  },
  {
    id: "resources",
    title: "Resources",
    href: "/resources",
    description: "Browse general course resources and reference material.",
    keywords: ["resources", "materials", "references", "course resources"],
    section: "Resources",
    access: "public",
  },
  {
    id: "quiz",
    title: "Quiz",
    href: "/quiz",
    description: "Practice with generated quiz questions.",
    keywords: ["quiz", "practice", "questions", "test me"],
    section: "Practice",
    access: "public",
  },
  {
    id: "upload-papers",
    title: "Upload past paper",
    href: "/past_papers/create",
    description: "Contribute a past paper for review.",
    keywords: ["upload paper", "submit paper", "contribute paper", "add paper"],
    section: "Create",
    access: "authenticated",
  },
  {
    id: "upload-notes",
    title: "Upload notes",
    href: "/notes/create",
    description: "Contribute course notes for review.",
    keywords: ["upload notes", "submit notes", "contribute notes", "add notes"],
    section: "Create",
    access: "authenticated",
  },
  {
    id: "moderation",
    title: "Moderator dashboard",
    href: "/mod",
    description: "Review submitted content and moderation queues.",
    keywords: ["moderation", "moderator", "review queue", "mod"],
    section: "Moderation",
    access: "moderator",
  },
  {
    id: "review-papers",
    title: "Review papers",
    href: "/mod/papers/review",
    description: "Review pending past paper submissions.",
    keywords: ["review papers", "paper review", "pending papers"],
    section: "Moderation",
    access: "moderator",
  },
  {
    id: "review-notes",
    title: "Review notes",
    href: "/mod/notes/review",
    description: "Review pending notes submissions.",
    keywords: ["review notes", "notes review", "pending notes"],
    section: "Moderation",
    access: "moderator",
  },
  {
    id: "upcoming-exams",
    title: "Upcoming exams",
    href: "/mod/upcoming",
    description: "Manage upcoming exam metadata.",
    keywords: ["upcoming exams", "exam schedule", "manage exams"],
    section: "Moderation",
    access: "moderator",
  },
  {
    id: "cli",
    title: "CLI",
    href: "/cli",
    description: "Install and use the ExamCooker CLI.",
    keywords: ["cli", "terminal", "command line", "install cli"],
    section: "Tools",
    access: "public",
  },
  {
    id: "privacy",
    title: "Privacy",
    href: "/privacy",
    description: "Read the privacy policy.",
    keywords: ["privacy", "privacy policy", "data"],
    section: "Legal",
    access: "public",
  },
  {
    id: "terms",
    title: "Terms",
    href: "/terms",
    description: "Read the terms of service.",
    keywords: ["terms", "terms of service", "legal"],
    section: "Legal",
    access: "public",
  },
  {
    id: "delete-account",
    title: "Delete account",
    href: "/delete",
    description: "Request account deletion.",
    keywords: ["delete account", "remove account", "account deletion"],
    section: "Account",
    access: "authenticated",
  },
  {
    id: "sign-in",
    title: "Sign in",
    href: "/auth",
    description: "Sign in to ExamCooker.",
    keywords: ["sign in", "login", "log in", "auth", "account"],
    section: "Account",
    access: "public",
  },
] as const satisfies readonly CommandSurfacePage[];

export const COMMAND_ROUTE_TEMPLATES = [
  {
    id: "course-papers",
    title: "Course past papers",
    hrefPattern: "/past_papers/course/[code]",
    description: "Open all past papers for a specific course code.",
    keywords: ["course papers", "course pyq", "past papers for course"],
    section: "Papers",
    access: "public",
  },
  {
    id: "course-exam-papers",
    title: "Course exam papers",
    hrefPattern: "/past_papers/course/[code]/[exam]",
    description: "Open papers for a specific course and exam type.",
    keywords: ["cat papers", "fat papers", "model papers", "exam papers"],
    section: "Papers",
    access: "public",
  },
  {
    id: "exam-hub",
    title: "Exam hub",
    hrefPattern: "/past_papers/exam/[exam]",
    description: "Open all papers for an exam type across courses.",
    keywords: ["cat 1", "cat 2", "fat", "mid", "quiz", "cia"],
    section: "Papers",
    access: "public",
  },
  {
    id: "course-notes",
    title: "Course notes",
    hrefPattern: "/notes/course/[code]",
    description: "Open notes for a specific course code.",
    keywords: ["notes for course", "course notes"],
    section: "Notes",
    access: "public",
  },
  {
    id: "course-syllabus",
    title: "Course syllabus",
    hrefPattern: "/syllabus/course/[code]",
    description: "Open syllabus for a specific course code.",
    keywords: ["syllabus for course", "course syllabus", "course outline"],
    section: "Syllabus",
    access: "public",
  },
  {
    id: "course-resources",
    title: "Course resources",
    hrefPattern: "/resources/course/[code]",
    description: "Open resources for a specific course code.",
    keywords: ["resources for course", "course resources"],
    section: "Resources",
    access: "public",
  },
] as const satisfies readonly CommandRouteTemplate[];

const COMMAND_APP_CAPABILITIES = [
  {
    id: "voice.open",
    kind: "event",
    title: "Open voice guide",
    description: "Start the voice study assistant.",
    keywords: [
      "voice",
      "voice agent",
      "voice guide",
      "audio assistant",
      "talk",
      "speak",
    ],
    tone: "Voice",
    section: "Tools",
    access: "authenticated",
    requiredFeature: "voiceAgent",
    eventName: "examcooker:voice-agent-start",
    eventDetail: { source: "nav" },
  },
  {
    id: "auth.sign-out",
    kind: "auth",
    title: "Sign out",
    description: "End the current session and return to the public home page.",
    keywords: ["logout", "log out", "sign out", "sign me out", "exit account"],
    tone: "Account",
    section: "Account",
    access: "authenticated",
    authAction: "signOut",
  },
] as const satisfies readonly CommandActionCapability[];

function pageToCapability(page: CommandSurfacePage): CommandActionCapability {
  return {
    id: `page.${page.id}`,
    kind: "route",
    title: `Open ${page.title}`,
    description: page.description,
    keywords: page.keywords,
    tone: page.section,
    section: page.section,
    access: page.access,
    href: page.href,
  };
}

function canAccess(
  access: CommandSurfaceAccess,
  context: Pick<CommandSurfaceContext, "authenticated" | "role">,
) {
  if (access === "public") return true;
  if (access === "authenticated") return context.authenticated === true;
  return context.authenticated === true && context.role === "moderator";
}

function hasRequiredFeature(
  capability: CommandActionCapability,
  context: Pick<CommandSurfaceContext, "voiceAgentEnabled">,
) {
  if (capability.requiredFeature === "voiceAgent") {
    return context.voiceAgentEnabled === true;
  }

  return true;
}

export function getCommandSurface(
  context: CommandSurfaceContext,
): CommandSurface {
  const normalizedContext = {
    query: context.query,
    currentPath: context.currentPath ?? null,
    authenticated: context.authenticated ?? null,
    role: context.role ?? null,
    voiceAgentEnabled: context.voiceAgentEnabled ?? null,
  };

  const pages = COMMAND_SURFACE_PAGES.filter((page) =>
    canAccess(page.access, normalizedContext),
  );
  const routeTemplates = COMMAND_ROUTE_TEMPLATES.filter((template) =>
    canAccess(template.access, normalizedContext),
  );
  const capabilities = [
    ...pages.map(pageToCapability),
    ...COMMAND_APP_CAPABILITIES.filter((capability) =>
      canAccess(capability.access ?? "public", normalizedContext) &&
      hasRequiredFeature(capability, normalizedContext),
    ),
  ];

  return {
    userContext: normalizedContext,
    pages,
    routeTemplates,
    capabilities,
    guidance: [
      "Use pages for direct navigation and capabilities for non-page app actions.",
      "Use route templates only to understand dynamic course/exam routes; course-specific navigation is handled by the command resolver.",
      "Return only capability IDs from the capabilities list. Do not invent IDs, hrefs, or JavaScript.",
      "Prefer one or two highly relevant actions over broad lists.",
    ],
  };
}

export const COMMAND_ACTION_CAPABILITIES = getCommandSurface({
  query: "",
  authenticated: true,
  role: "moderator",
  voiceAgentEnabled: true,
}).capabilities;

export function getCommandActionCapability(
  id: string,
  context?: CommandSurfaceContext,
): CommandActionCapability | null {
  const capabilities = context
    ? getCommandSurface(context).capabilities
    : COMMAND_ACTION_CAPABILITIES;

  return capabilities.find((capability) => capability.id === id) ?? null;
}
