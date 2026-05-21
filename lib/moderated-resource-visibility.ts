type Viewer = {
  id?: string | null;
  role?: "USER" | "MODERATOR" | null;
};

type ModeratedResource = {
  authorId?: string | null;
  isClear: boolean;
};

export function canViewModeratedResource(
  resource: ModeratedResource,
  viewer: Viewer | null | undefined,
) {
  if (resource.isClear) {
    return true;
  }

  if (viewer?.role === "MODERATOR") {
    return true;
  }

  return Boolean(resource.authorId && viewer?.id === resource.authorId);
}
