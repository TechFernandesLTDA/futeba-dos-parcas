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

## Web Management Surfaces

Current web P1 surfaces:

- Admin venue list filters by publication status, billing status, field type, and commercial amenities.
- Admin venue cards expose whether the venue is visible to regular users.
- Admins can edit monthly fee, billing due day, and internal billing notes from the venue list.
- Public venue discovery filters by search, field type, amenities, and maximum hourly price from active field documents.
- Field owner dashboard shows publication, billing status, monthly fee, due day, and visibility warnings.
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

## Follow-Up Scope

- Add the billing ledger and recurring monthly charge workflow tracked by #3114.
- Add owner publication/change requests with admin approval tracked by #3115.
- Firestore indexes must be added when server-side filters replace client filtering.
- Android/KMP UI parity must be handled before a mobile release claiming full support.
