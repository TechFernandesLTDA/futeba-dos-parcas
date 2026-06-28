# Venue Monetization

This document describes the first monetization path for Futeba dos Parcas: field owners pay a monthly fee so their venues can be available to players in the app.

## Core Rule

A venue must not be selectable by regular users unless it is active, verified, published, commercially eligible, and has at least one active field.

Legacy venues that are already `is_active == true` and `is_verified == true` are treated as published/active until the admin migration fills the commercial fields.

## Location Commercial Fields

- `publication_status`: `DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `SUSPENDED`, or `REJECTED`.
- `commercial_status`: mirrors the commercial account state: `TRIAL`, `ACTIVE`, `OVERDUE`, `SUSPENDED`, or `CANCELLED`.
- `subscription_status`: billing status used by UI filters and eligibility.
- `monthly_fee_cents`: monthly fee charged to the venue owner, in cents.
- `billing_due_day`: day of month for billing, 1-31.
- `billing_starts_at`: when billing starts.
- `billing_expires_at`: when current billing eligibility expires.
- `published_at` / `published_by`: publication audit metadata.
- `unpublished_reason`: reason for suspension/rejection/unpublication.
- `owner_notes`: notes provided by the owner.
- `admin_notes`: internal admin notes.

## Protected Operations

The client cannot directly write publication or billing fields unless the caller is `ADMIN`. Sensitive operations should go through Cloud Functions:

- `setLocationPublicationStatus`
- `setLocationSubscription`
- `registerLocationSubscriptionPayment`

Each function writes both `locations/{locationId}/commercial_events` and global `audit_logs`.

## User-Facing Eligibility

Web helpers use `isLocationCommerciallyAvailable(location)`.

Required current-state checks:

- `isActive === true`
- `isVerified === true`
- `publicationStatus === PUBLISHED` with legacy fallback for verified venues
- `subscriptionStatus` is `TRIAL` or `ACTIVE` with legacy fallback
- `hasActiveFields !== false`

## Follow-Up Scope

- Admin list/detail must expose filters and complete billing edit dialogs.
- Field owner dashboard must show publication, subscription, and pending checklist.
- Firestore indexes must be added when server-side filters replace client filtering.
- Android/KMP UI parity must be handled before a mobile release claiming full support.
