# Venue Monetization

This document describes the first monetization path for Futeba dos Parcas: field owners pay a monthly fee so their venues can be available to players in the app.

## Core Rule

A venue must not be selectable by regular users unless it is active, verified, published, commercially eligible, and has at least one active field.

Legacy venues that are already `is_active == true` and `is_verified == true` are treated as published/active until the admin migration fills the commercial fields.

## Location Commercial Fields

Location billing fields remain supported for legacy compatibility and per-venue
visibility, but the account-level commercial source of truth is
`venue_accounts/{ownerUid}`. New admin workflows should prefer the account
document and let Cloud Functions denormalize the current account state back into
linked locations.

- `publication_status`: `DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `SUSPENDED`, or `REJECTED`.
- `commercial_status`: mirrors the commercial account state: `TRIAL`, `ACTIVE`, `OVERDUE`, `SUSPENDED`, or `CANCELLED`.
- `subscription_status`: billing status used by UI filters and eligibility.
- `billing_plan_code`: base plan tracked by the commercial team (`TRIAL`, `BASIC`, `PRO`, `ENTERPRISE`, `CUSTOM`).
- `billing_plan_label`: human-friendly commercial label shown in admin and owner surfaces.
- `billing_cycle`: recurrence cycle (`MONTHLY`, `QUARTERLY`, `SEMIANNUAL`, `ANNUAL`, `CUSTOM`).
- `billing_base_fee_cents`: default plan price in cents before negotiation.
- `monthly_fee_cents`: monthly fee charged to the venue owner, in cents.
- `billing_due_day`: day of month for billing, 1-31.
- `billing_starts_at`: when billing starts.
- `billing_expires_at`: when current billing eligibility expires.
- `billing_exception_note`: reason for negotiated exception or custom billing handling.
- `published_at` / `published_by`: publication audit metadata.
- `unpublished_reason`: reason for suspension/rejection/unpublication.
- `owner_notes`: notes provided by the owner.
- `admin_notes`: internal admin notes.
- `venue_account_id`: owner-level commercial account linked to this venue.
- `venue_account_status`: denormalized account status used by availability and admin filters.
- `venue_account_charge_scope`: account billing scope (`OWNER`, `LOCATION`, `FIELD_COUNT`, `MANUAL_OVERRIDE`).
- `venue_account_plan_code` / `venue_account_plan_label`: denormalized plan shown in admin lists.
- `venue_account_monthly_total_cents`: current account monthly total, denormalized for dashboards and exports.
- `venue_account_linked_locations_count`: number of venues on the same account.
- `venue_account_active_fields_count`: active fields counted for account-level billing.

## Venue Accounts

`venue_accounts/{ownerUid}` represents the commercial contract for one field
owner. The document id intentionally matches the owner's user id so admin,
rules, backfill, and CRM screens can join data without an extra lookup table.

Core fields:

- `owner_uid`: owner user id.
- `status`: `TRIAL`, `ACTIVE`, `OVERDUE`, `SUSPENDED`, or `CANCELLED`.
- `billing_scope`: `OWNER`, `LOCATION`, `FIELD_COUNT`, or `MANUAL_OVERRIDE`.
- `billing_plan_code` / `billing_plan_label`: internal/commercial plan.
- `billing_cycle`: `MONTHLY`, `QUARTERLY`, `SEMIANNUAL`, `ANNUAL`, or `CUSTOM`.
- `billing_base_fee_cents`: owner-level base fee when billing by owner or manual override.
- `default_location_fee_cents`: fee multiplied by linked venues when billing by location.
- `price_per_active_field_cents`: fee multiplied by active fields when billing by field count.
- `monthly_fee_override_cents`: fixed manual override.
- `billing_due_day`, `billing_starts_at`, `billing_expires_at`: payment schedule.
- `billing_contact_name`, `billing_contact_email`, `billing_contact_phone`, `billing_contact_document`: finance contact.
- `linked_location_ids`: venues currently covered by the account.
- `linked_locations_count`, `published_locations_count`, `active_fields_count`: computed account metrics.
- `legacy_monthly_fee_total_cents`: sum of legacy per-location monthly fees.
- `computed_monthly_fee_cents`: authoritative current monthly total for admin CRM and dashboards.
- `created_at`, `created_by`, `updated_at`, `updated_by`: audit metadata.

Every account change writes an immutable event under
`venue_accounts/{ownerUid}/events/{eventId}` and a global `audit_logs` entry.
Client writes are denied by Firestore rules; account mutations must use admin
Cloud Functions.

## Protected Operations

The client cannot directly write publication or billing fields unless the caller is `ADMIN`. Sensitive operations should go through Cloud Functions:

- `requestVenueOwnerOnboarding`
- `reviewVenueOwnerOnboarding`
- `upsertVenueAccount`
- `linkLocationToVenueAccount`
- `unlinkLocationFromVenueAccount`
- `setLocationPublicationStatus`
- `setLocationSubscription`
- `registerLocationSubscriptionPayment`
- `assignLocationOwner`
- `inviteLocationManager`
- `acceptLocationManagerInvite`
- `removeLocationManager`

Each function writes both `locations/{locationId}/commercial_events` and global `audit_logs`.
Billing-sensitive functions also write immutable entries to
`locations/{locationId}/subscription_ledger`.
Venue-account functions write immutable entries to
`venue_accounts/{ownerUid}/events` plus global `audit_logs`, and synchronize the
denormalized `venue_account_*` fields on linked locations.

## Owner Commercial Onboarding

The controlled path from player to field owner is stored in
`venue_owner_onboarding/{ownerUid}`.

Statuses:

- `LEAD`: commercial interest exists, but has not been submitted for review.
- `IN_REVIEW`: owner submitted contact/business information and accepted that
  publication and billing require admin approval.
- `APPROVED`: admin approved the commercial onboarding and the user is promoted
  to `FIELD_OWNER`.
- `REJECTED`: admin rejected the request with a reason; the owner can resubmit.
- `SUSPENDED` / `CANCELLED`: admin-only terminal/blocked states.

Security rules allow the owner and admins to read the onboarding document and
event log, but deny all client writes. All writes must go through Cloud
Functions:

- `requestVenueOwnerOnboarding`: authenticated owner submits or updates an
  `IN_REVIEW` request. It never grants `FIELD_OWNER`.
- `reviewVenueOwnerOnboarding`: admin-only review. Approval requires checklist
  confirmation for contact, locations, terms, and billing; approval synchronizes
  Firebase Auth custom claims and `users/{uid}.role`.

The admin user CRM includes the onboarding status so admins can review the
request from the same commercial profile used to inspect linked venues.

Owner/manager access must not be granted by editing `locations/{locationId}.managers`
directly from the client. Admins can transfer `owner_id` through
`assignLocationOwner`; owners and admins create manager invites through
`inviteLocationManager`; the invited user only becomes a manager after accepting
with `acceptLocationManagerInvite`.

## User-Facing Eligibility

Web helpers use `isLocationCommerciallyAvailable(location)`.

Required current-state checks:

- `isActive === true`
- `isVerified === true`
- `publicationStatus === PUBLISHED` with legacy fallback for verified venues
- `subscriptionStatus` is `TRIAL` or `ACTIVE` with legacy fallback
- `hasActiveFields !== false`

## Web Management Surfaces

Current web P1 surfaces:

- Admin venue list filters by publication status, billing status, field type, and commercial amenities.
- Admin venue cards expose whether the venue is visible to regular users.
- Admins can edit base plan, cycle, base fee, negotiated fee, billing start, due day, public-safe exception status, and internal billing notes from the venue list.
- Admins see expected monthly revenue and counts for eligible, overdue, suspended, and cancelled venues.
- Admins and venue owners can inspect the subscription ledger with plan/status/payment/review events.
- Public venue discovery filters by search, field type, amenities, and maximum hourly price from active field documents.
- Field owner dashboard shows publication, billing status, plan summary, negotiated monthly fee, due day, billing start, and visibility warnings without exposing internal admin notes.
- Admin user management highlights field owners and summarizes their venue counts, published venues, and commercial pending items.
- Venue registration/editing captures structured address, phone, WhatsApp, Instagram, website, commercial amenities, multiple venue photos, and coordinates.
- Venue registration/editing manages individual fields at `locations/{locationId}/fields`, including type, hourly price, surface, dimensions, covered status, active status, and field photos.

## Field Documents

Each playable field should be stored under its parent venue at `locations/{locationId}/fields/{fieldId}`.

- `location_id`: parent location id, immutable after creation.
- `name`: user-facing field/court name.
- `type`: `SOCIETY`, `FUTSAL`, `CAMPO`, `AREIA`, or `OUTROS`.
- `hourly_price` / `price_per_hour`: field price used by filters, rankings, and commercial stats.
- `surface`: optional surface description such as synthetic grass, court floor, grass, or sand.
- `dimensions`: optional free-text dimensions.
- `is_covered`: whether the field is covered.
- `is_active`: whether the field can count toward venue availability.
- `photos` / `photo_url`: field photos, with `photo_url` kept for legacy/card compatibility.
- `created_at` / `updated_at`: server timestamps.

The parent location stores denormalized summary fields for discovery and admin operations:

- `field_count`
- `primary_field_type`
- `has_active_fields`
- `photos` / `photo_url`

## Legacy Backfill Before Broad Monetization

Tracked by #3131.

Before enforcing monetized venue rules broadly, run the venue backfill in
dry-run mode and review the report:

```bash
cd functions
npm run build
npm run backfill:venues
```

The script audits `locations`, nested `locations/{locationId}/fields`, and
legacy root `fields`. It also groups venues by `owner_id` to create or
synchronize `venue_accounts/{ownerUid}` and denormalize `venue_account_*`
fields back to linked venues. It can safely backfill:

- missing `publication_status`, defaulting to `PENDING_REVIEW`;
- missing `subscription_status` / `commercial_status`, defaulting to `TRIAL`;
- missing `monthly_fee_cents` and `billing_due_day`, defaulting to `null`;
- inconsistent `field_count`, `has_active_fields`, `field_type`, and
  `primary_field_type`;
- missing nested field documents when legacy `field_count` says fields should
  exist;
- field defaults such as `location_id`, `type`, `is_active`, `hourly_price`,
  `photos`, `amenities`, and `managers`.
- one owner-level venue account per `owner_id`, preserving existing explicit
  account billing settings where present;
- `linked_location_ids`, account counts, legacy monthly total, computed monthly
  total, and denormalized `venue_account_*` fields on each eligible venue.

Only run execute mode after reviewing the dry-run output:

```bash
cd functions
npm run backfill:venues:execute
```

Safety rules:

- The backfill never publishes a venue automatically.
- Existing explicit admin decisions are preserved.
- Venues with missing price, owner, photos, address, or playable fields remain
  in manual review.
- Venues already linked to a different `venue_account_id` are reported for
  manual review and are not relinked automatically.
- Legacy root `fields` are counted and reported to avoid duplicate nested
  field creation.
- Publication still requires an admin decision through
  `setLocationPublicationStatus`.

## Billing Ledger

The authoritative financial trail for venue billing lives in
`locations/{locationId}/subscription_ledger/{entryId}`.

Ledger entries are immutable and written only by Cloud Functions using the Admin SDK.
Clients can read the ledger only when they are the venue owner, a venue manager, or an admin.

Current event types:

- `SUBSCRIPTION_STATUS_CHANGED`: admin changed plan, fee, due day, or subscription status.
- `PAYMENT_REGISTERED`: admin registered and approved a payment directly.
- `PAYMENT_RECEIPT_SUBMITTED`: owner/admin submitted a private receipt for review.
- `PAYMENT_RECEIPT_APPROVED`: admin approved a receipt and reactivated the subscription.
- `PAYMENT_RECEIPT_REJECTED`: admin rejected a receipt without changing the subscription.

Each entry can include `amount_cents`, `period_key`, `payment_id`, `method`,
`review_status`, previous/next subscription status, base plan code/label,
billing cycle, base plan amount, negotiated amount, due day, exception note,
actor, reason, effective date, and server `created_at`.

## Follow-Up Scope

- Add the recurring monthly charge workflow tracked by #3132.
- Add owner publication/change requests with admin approval tracked by #3115.
- Firestore indexes must be added when server-side filters replace client filtering.
- Android/KMP UI parity must be handled before a mobile release claiming full support.
