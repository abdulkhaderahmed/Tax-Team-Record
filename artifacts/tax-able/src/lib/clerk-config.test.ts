import assert from "node:assert/strict";
import test from "node:test";
import {
  clerkConfigurationMode,
  requireValidClerkConfiguration,
} from "./clerk-config";

test("Clerk mode is configured only when both keys are present", () => {
  assert.equal(
    clerkConfigurationMode({
      CLERK_SECRET_KEY: "secret",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "publishable",
    }),
    "configured",
  );
  assert.equal(clerkConfigurationMode({}), "demo");
});

test("partial Clerk configuration fails closed instead of entering demo mode", () => {
  assert.equal(
    clerkConfigurationMode({ CLERK_SECRET_KEY: "secret" }),
    "invalid",
  );
  assert.equal(
    clerkConfigurationMode({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "publishable",
    }),
    "invalid",
  );
  assert.throws(
    () => requireValidClerkConfiguration({ CLERK_SECRET_KEY: "secret" }),
    /partially configured/i,
  );
});
