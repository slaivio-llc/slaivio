import { CommunicationSettingsHub } from "@/components/workspace/communication-settings-hub";
import { RouteAccessGuard } from "@/components/permissions/route-access-guard";

export const dynamic="force-dynamic";
export default function Page(){return <RouteAccessGuard permission="pilot.settings.read"><CommunicationSettingsHub/></RouteAccessGuard>}
