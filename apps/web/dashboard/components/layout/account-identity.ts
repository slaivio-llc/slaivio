export function accountDisplayName(user: { fullName?: string | null; firstName?: string | null; primaryEmailAddress?: { emailAddress?: string } | null } | null | undefined) {
  const name = user?.fullName?.trim() || user?.firstName?.trim();
  return name && name !== user?.primaryEmailAddress?.emailAddress ? name : "Mon compte";
}
