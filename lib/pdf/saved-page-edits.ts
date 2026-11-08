// Page edits shown by the viewer come from the server prop, except right after
// a local save: until the refreshed prop catches up, the saved value is shown.
export type SavedPageEditsState<T> = {
  propKey: string;
  value: T;
  /** Keys of local saves not yet reflected by the prop, oldest first. */
  pendingKeys: string[];
};

export function savePageEditsLocally<T>(
  state: SavedPageEditsState<T>,
  value: T,
  key: string,
): SavedPageEditsState<T> {
  return { ...state, value, pendingKeys: [...state.pendingKeys, key] };
}

export function reconcileSavedPageEdits<T>(
  state: SavedPageEditsState<T>,
  propKey: string,
  propValue: T,
): SavedPageEditsState<T> {
  if (state.propKey === propKey) return state;

  const savedIndex = state.pendingKeys.indexOf(propKey);
  // An earlier local save arrived; a later one is still on its way.
  if (savedIndex >= 0 && savedIndex < state.pendingKeys.length - 1) {
    return { ...state, propKey, pendingKeys: state.pendingKeys.slice(savedIndex + 1) };
  }

  // The latest local save arrived, or the server holds a change made
  // elsewhere. Either way the prop is authoritative again.
  return { propKey, value: propValue, pendingKeys: [] };
}
