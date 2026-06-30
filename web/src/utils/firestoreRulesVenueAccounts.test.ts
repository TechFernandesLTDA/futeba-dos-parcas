import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Firestore venue account rules', () => {
  const rules = readFileSync(resolve(process.cwd(), '../firestore.rules'), 'utf8');

  it('protegem a coleção venue_accounts para leitura somente de admin ou dono', () => {
    expect(rules).toContain('match /venue_accounts/{accountId}');
    expect(rules).toContain('allow read: if isAuthenticated() && (isAdmin() || userId() == accountId);');
    expect(rules).toContain('match /events/{eventId}');
    expect(rules).toContain('allow create, update, delete: if false;');
  });

  it('impedem owner e manager de alterar denormalizações comerciais agregadas da quadra', () => {
    expect(rules).toContain("fieldUnchanged('venue_account_id')");
    expect(rules).toContain("fieldUnchanged('venue_account_status')");
    expect(rules).toContain("fieldUnchanged('venue_account_charge_scope')");
    expect(rules).toContain("fieldUnchanged('venue_account_plan_code')");
    expect(rules).toContain("fieldUnchanged('venue_account_plan_label')");
    expect(rules).toContain("fieldUnchanged('venue_account_monthly_total_cents')");
    expect(rules).toContain("fieldUnchanged('venue_account_linked_locations_count')");
    expect(rules).toContain("fieldUnchanged('venue_account_active_fields_count')");
  });
});
