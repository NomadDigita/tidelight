import test from "node:test";
import assert from "node:assert/strict";
import { canManageOrganization, canRevokeOrganizationKey, canWriteOrganization } from "../lib/tic/organization-rbac.ts";

test("organization roles grant only the expected console capabilities", () => {
  assert.deepEqual(["owner", "admin", "developer", "reader"].map(canManageOrganization), [true, true, false, false]);
  assert.deepEqual(["owner", "admin", "developer", "reader"].map(canWriteOrganization), [true, true, true, false]);
});

test("readers can revoke their own keys but cannot revoke another member's key", () => {
  assert.equal(canRevokeOrganizationKey("reader", true), true);
  assert.equal(canRevokeOrganizationKey("reader", false), false);
  assert.equal(canRevokeOrganizationKey("developer", false), true);
});
