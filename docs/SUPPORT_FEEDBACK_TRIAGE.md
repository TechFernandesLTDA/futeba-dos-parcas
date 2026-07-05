# Support Feedback Triage

Operational routine for `user_feedback` items shown in the web admin screen at `/admin/feedback`.

## Daily triage

1. Open `/admin/feedback` with an `ADMIN` account.
2. Check critical feedbacks first. Critical open items should either move to `triaged` with an owner or get an issue link on the same day.
3. Search for existing similar feedbacks before creating a GitHub issue. Use title, route, error code, user email, and the possible-duplicate badge.
4. For each actionable item, set:
   - `status`
   - `assignee`
   - `github_issue_number` and `github_issue_url` when an issue exists
   - `suspected_duplicate_of` when the item should be tracked under another feedback or issue
   - `admin_notes` with the short operational decision

## Weekly sweep

1. Review `triaged`, `issue_created`, and `in_progress` items without PR or release links.
2. Link `github_pr_number` / `github_pr_url` after implementation starts.
3. Link `release_version` / `release_url` and move to `released` only after the fix ships.
4. Move non-actionable feedback to `rejected` with a clear `admin_notes` reason.
5. Revisit possible duplicates and consolidate equivalent reports under the oldest or clearest issue.

## Status contract

- `open`: received and not reviewed yet.
- `triaged`: reviewed by support/admin and assigned or categorized.
- `issue_created`: represented by a GitHub issue.
- `in_progress`: implementation or investigation is actively happening.
- `released`: fix or improvement shipped to users.
- `rejected`: not actionable, duplicate-only, out of scope, or intentionally declined.

## Firestore access

The `user_feedback` collection is intentionally restricted:

- Users can create and read only their own feedback.
- Admins can list and update feedback for triage.
- Deletes remain blocked.

If writes fail from `/admin/feedback`, verify the admin user's custom claim / Firestore role and the `user_feedback` rules before changing the UI.
