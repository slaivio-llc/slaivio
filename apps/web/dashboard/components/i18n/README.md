# Dashboard language

French UI copy is the source key. English messages live in
`messages/dashboard.en.json`. The landing keeps its existing next-intl catalogues.

For dashboard presentation:

```tsx
function Example() {
  useDashboardMessages(); // Subscribe without remounting or resetting form state.
  return <button>{dashboardText('Enregistrer')}</button>;
}
```

Use numbered parameters for dynamic copy:
`dashboardText('Ouvrir la fiche {0}', reference)`.
Use `dashboardFormatLocale()` for displayed dates and numbers. Do not change
stored dates, currencies, enum codes, permission codes, form values or API payloads.

Translate display labels at render time, not when initialising module-level maps.
Do not translate customer names, free-text notes, knowledge content, invoice lines,
outbound message templates or other agency-authored data. Those retain their own
language. Static SaaS plan descriptions and system feedback are UI copy.

The personal language preference takes priority over the agency default. Without
either, the landing language cookie is used, then French. Language changes are
published to mounted components and other browser tabs. The initial render matches
the French server snapshot before restoring the saved preference.

Run `components/i18n` tests after edits. They cover English/French switching,
unchanged input and payment values, Tanzania phone entry, hydration, message
parameters and coverage of source-level `dashboardText` keys.
