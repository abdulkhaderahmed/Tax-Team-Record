export type ClerkConfigurationMode = "configured" | "demo" | "invalid";

type ClerkEnvironment = Readonly<Record<string, string | undefined>>;

export function clerkConfigurationMode(
  environment: ClerkEnvironment,
): ClerkConfigurationMode {
  const hasSecretKey = Boolean(environment.CLERK_SECRET_KEY?.trim());
  const hasPublishableKey = Boolean(
    environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim(),
  );

  if (hasSecretKey && hasPublishableKey) return "configured";
  if (!hasSecretKey && !hasPublishableKey) return "demo";
  return "invalid";
}

export function requireValidClerkConfiguration(
  environment: ClerkEnvironment,
): Exclude<ClerkConfigurationMode, "invalid"> {
  const mode = clerkConfigurationMode(environment);
  if (mode === "invalid") {
    throw new Error(
      "Clerk is partially configured. Set both CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, or leave both unset for local demo mode.",
    );
  }
  return mode;
}
