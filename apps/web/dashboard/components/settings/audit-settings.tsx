"use client";

import { useEffect, useState } from "react";
import { PermissionGuard } from "@/components/permissions/permission-guard";
import { useDashboardLocale } from "@/components/i18n/dashboard-language";
import { getAuditLogs, type AuditLog } from "@/services/audit";

export function AuditSettings() {
  const locale = useDashboardLocale();
  return (
    <PermissionGuard
      permission="audit.read"
      fallback={
        <div className="rounded-2xl border border-[#e6e9e8] bg-white p-6 text-[13px] leading-6 text-[#65716b]">
          {locale === "en"
            ? "You are not authorized to view the organization activity history."
            : "Vous n’avez pas l’autorisation de consulter l’historique des actions de l’organisation."}
        </div>
      }
    >
      <AuditLogList />
    </PermissionGuard>
  );
}

function AuditLogList() {
  const locale = useDashboardLocale();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAuditLogs()
      .then(setLogs)
      .catch(() => setError("L’historique des actions n’a pas pu être chargé."))
      .finally(() => setLoading(false));
  }, []);

  const dateFormatter = new Intl.DateTimeFormat(locale === "en" ? "en" : "fr", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e6e9e8] bg-white shadow-[0_4px_20px_rgba(25,40,35,.035)]">
      <header className="border-b border-[#edf0ef] px-5 py-4 sm:px-6">
        <h2 className="text-[15px] font-semibold text-[#26322d]">
          {locale === "en" ? "Organization activity" : "Activité de l’organisation"}
        </h2>
        <p className="mt-1 text-[12px] leading-5 text-[#78827e]">
          {locale === "en"
            ? "Sensitive changes recorded across the organization. Details and personal data are intentionally omitted here."
            : "Modifications sensibles enregistrées pour l’organisation. Les détails et données personnelles ne sont pas affichés ici."}
        </p>
      </header>
      {loading ? (
        <p className="px-6 py-8 text-[13px] text-[#78827e]">
          {locale === "en" ? "Loading activity…" : "Chargement de l’historique…"}
        </p>
      ) : error ? (
        <p role="alert" className="px-6 py-8 text-[13px] text-[#a33d36]">{error}</p>
      ) : logs.length === 0 ? (
        <p className="px-6 py-8 text-[13px] text-[#78827e]">
          {locale === "en" ? "No recorded activity yet." : "Aucune action enregistrée pour le moment."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-[12px]">
            <thead className="bg-[#f7f9f8] text-[11px] font-semibold uppercase tracking-wide text-[#78827e]">
              <tr>
                <th className="px-5 py-3">{locale === "en" ? "Date" : "Date"}</th>
                <th className="px-5 py-3">{locale === "en" ? "User" : "Auteur"}</th>
                <th className="px-5 py-3">{locale === "en" ? "Action" : "Action"}</th>
                <th className="px-5 py-3">{locale === "en" ? "Resource" : "Ressource"}</th>
                <th className="px-5 py-3">{locale === "en" ? "Severity" : "Niveau"}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-[#edf0ef] text-[#46524c]">
                  <td className="whitespace-nowrap px-5 py-3">{dateFormatter.format(new Date(log.created_at))}</td>
                  <td className="px-5 py-3">{log.actor_name || log.actor_id || "—"}</td>
                  <td className="px-5 py-3 font-medium">{log.action || "—"}</td>
                  <td className="px-5 py-3">{[log.entity_type, log.entity_id].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-5 py-3">{log.severity || "INFO"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
