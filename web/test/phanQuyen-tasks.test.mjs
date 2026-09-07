import test from "node:test";
import assert from "node:assert/strict";

import { roleCanSeeTab } from "../src/lib/phanQuyen.js";

const operatorAndAdminRoles = ["IPC", "MEP", "LOT", "QA", "ADMIN", "IT"];
const restrictedRoles = ["IPC", "MEP", "LOT"];
const fullAccessRoles = ["QA", "ADMIN", "IT"];

test("all operator and admin roles can access the tasks tab", () => {
  for (const role of operatorAndAdminRoles) {
    assert.equal(roleCanSeeTab(role, "tasks"), true, `${role} should see tasks`);
  }
});

test("unknown roles cannot access tasks or settings", () => {
  // Empty role is the existing demo/loading behavior; this change only grants
  // tasks to the six explicitly assigned roles and adds no backend permission.
  for (const role of ["UNKNOWN", "viewer", "GUEST"]) {
    assert.equal(roleCanSeeTab(role, "tasks"), false, `${role} should not see tasks`);
    assert.equal(roleCanSeeTab(role, "settings"), false, `${role} should not see settings`);
  }
});

test("settings access remains restricted to full-access roles", () => {
  for (const role of restrictedRoles) {
    assert.equal(roleCanSeeTab(role, "settings"), false, `${role} should not see settings`);
  }
  for (const role of fullAccessRoles) {
    assert.equal(roleCanSeeTab(role, "settings"), true, `${role} should see settings`);
  }
});
