import type { CargoDashboardData } from './cargo-dashboard';

function cell(value: unknown) {
  let text = String(value ?? '');
  // Prevent spreadsheet formula execution, including leading whitespace.
  if (/^\s*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Export the displayed aggregate snapshot, not an incomplete parcel listing. */
export function dashboardCsv(data: CargoDashboardData) {
  const rows: unknown[][] = [
    ['snapshot_at','workspace','scope','timezone','period_start','period_end','section','metric','currency','value'],
  ];
  const context = [data.generated_at,data.workspace.name,data.scope,data.period.timezone,data.period.current.start,data.period.current.end];
  for (const [metric,value] of Object.entries(data.flows)) rows.push([...context,'flow',metric,'',value]);
  for (const [metric,value] of Object.entries(data.states)) rows.push([...context,'state',metric,'',value]);
  for (const [metric,value] of Object.entries(data.previous_flows || {})) {
    rows.push([data.generated_at,data.workspace.name,data.scope,data.period.timezone,data.period.previous?.start,data.period.previous?.end,'previous_flow',metric,'',value]);
  }
  for (const entry of data.finance?.currencies || []) {
    for (const metric of ['collected','outstanding','overdue'] as const) rows.push([data.generated_at,data.workspace.name,'office',data.period.timezone,data.period.current.start,data.period.current.end,'finance',metric,entry.currency,entry[metric]]);
  }
  return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
