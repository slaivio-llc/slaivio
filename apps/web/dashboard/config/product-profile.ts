export const PRODUCT_PROFILES = {
  PILOT_V1: "PILOT_V1",
  PARCEL_FREIGHT: "PARCEL_FREIGHT",
  CARGO_OS: "CARGO_OS",
} as const;

export type ProductProfile = (typeof PRODUCT_PROFILES)[keyof typeof PRODUCT_PROFILES];

const pilotVisiblePaths = [
  "/app",
  "/app/followups",
  "/app/knowledge",
  "/app/settings",
  "/app/support",
] as const;

const pilotVisibleDetailPrefixes = [
  "/app/dossiers",
  "/app/inbox",
] as const;

/**
 * The Pilot is the official product surface. The former Cargo OS remains
 * available behind an explicit profile so its code and data can be reused
 * later without leaking unfinished modules into the agency experience.
 */
export function getProductProfile(): ProductProfile {
  const configured = process.env.NEXT_PUBLIC_PRODUCT_PROFILE?.trim().toUpperCase();

  if (configured === PRODUCT_PROFILES.CARGO_OS) return PRODUCT_PROFILES.CARGO_OS;
  if (configured === PRODUCT_PROFILES.PILOT_V1) return PRODUCT_PROFILES.PARCEL_FREIGHT;

  // Backward compatibility with the former one-capability pilot flag.
  if (process.env.NEXT_PUBLIC_PILOT_MODE === "0") return PRODUCT_PROFILES.CARGO_OS;
  return PRODUCT_PROFILES.PARCEL_FREIGHT;
}

export function isPilotV1() {
  return getProductProfile() === PRODUCT_PROFILES.PILOT_V1;
}

/**
 * SLAIVIO currently serves parcel and freight agencies. Legacy organization
 * types are retained in storage but no longer select a vehicle-import UI.
 */
export function getOrganizationProductProfile(
  organizationType?: string | null,
): ProductProfile {
  const normalized = organizationType?.trim().toUpperCase();
  if (normalized === PRODUCT_PROFILES.CARGO_OS) return PRODUCT_PROFILES.CARGO_OS;
  if (normalized === PRODUCT_PROFILES.PARCEL_FREIGHT) return PRODUCT_PROFILES.PARCEL_FREIGHT;
  if (normalized === "VEHICLE_IMPORT") return PRODUCT_PROFILES.PARCEL_FREIGHT;
  if (normalized === "AGENCY") return PRODUCT_PROFILES.PARCEL_FREIGHT;
  return getProductProfile();
}

export function usesCompactAgencyShell(profile: ProductProfile) {
  return profile !== PRODUCT_PROFILES.CARGO_OS;
}

export function isPilotVisiblePath(pathname: string) {
  if (pilotVisiblePaths.includes(pathname as (typeof pilotVisiblePaths)[number])) return true;
  return pilotVisibleDetailPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function pilotRedirectTarget(pathname: string) {
  if (pathname === "/app/assistant" || pathname.startsWith("/app/assistant/")) {
    return "/app/inbox";
  }
  if (pathname === "/app/clients" || pathname.startsWith("/app/clients/")) {
    return "/app/dossiers";
  }
  return "/app";
}
