
"use client";
import {dashboardText,useDashboardMessages} from '@/components/i18n/dashboard-messages';
import Image from "next/image";

export function SlaivioLogoLoader({
  label = "Chargement de SLAIVIO",
  overlay = false,
}: {
  label?: string;
  overlay?: boolean;
}) {
  useDashboardMessages();
  return (
    <div
      role="status"
      aria-label={dashboardText(label)}
      className={`${overlay ? "fixed inset-0 z-[120]" : "min-h-screen"} grid place-items-center bg-white`}
    >
      <Image
        src="/slaivio-icon-official.png"
        width={58}
        height={58}
        priority
        alt={dashboardText("")}
        className="slaivio-logo-loader h-[58px] w-[58px] object-contain"
      />
    </div>
  );
}
