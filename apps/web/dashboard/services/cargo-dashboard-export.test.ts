import { expect, it } from 'vitest';
import { dashboardCsv } from './cargo-dashboard-export';
import type { CargoDashboardData } from './cargo-dashboard';

it('exports snapshot context, keeps currencies separate and escapes formulas',()=>{
  const data={generated_at:'2026-10-07',workspace:{name:' =HYPERLINK("bad")'},scope:'network',
    period:{timezone:'UTC',current:{start:'2026-10-01',end:'2026-10-07'},previous:null},
    flows:{received:4},states:{blocked:1},previous_flows:null,
    finance:{currencies:[{currency:'USD',collected:'10.00',outstanding:'2.00',overdue:'0.00'},{currency:'CDF',collected:'20000.00',outstanding:'0.00',overdue:'0.00'}]}} as CargoDashboardData;
  const csv=dashboardCsv(data);
  expect(csv).toContain('"\' =HYPERLINK(""bad"")"');
  expect(csv).toContain('"finance","collected","USD","10.00"');
  expect(csv).toContain('"finance","collected","CDF","20000.00"');
  expect(csv).toContain('"office","UTC"');
});
