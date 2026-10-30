import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import {MemberAccessBoundary} from '@/components/permissions/member-access-boundary';

export const dynamic = 'force-dynamic';

export default function DashboardAppLayout({ children }: { children: ReactNode }) {
  return <AppShell><MemberAccessBoundary>{children}</MemberAccessBoundary></AppShell>;
}
