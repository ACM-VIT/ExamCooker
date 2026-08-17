# Account upload status

The account page derives its labels from the existing `PastPaper` moderation fields:

- `Published`: `isClear` is true.
- `Uploaded`: the paper is stored but no AI review has been written yet.
- `In review`: the automated review completed or failed, and the paper remains in the moderator queue.
- `Needs changes`: the AI review returned `needs_changes`.
- `Duplicate detected`: the AI review returned `duplicate` while the item is still queued.
- `Duplicate`: an archived item has a duplicate review result.
- `Rejected`: an archived item was not published and was not marked as a duplicate.

This feature intentionally does not introduce another status column or duplicate the moderation state machine.
