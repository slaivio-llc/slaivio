export function getTimeZoneOptions(locale: string) {
  const timeZones = typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["Africa/Kinshasa"];
  if (!timeZones.includes("UTC")) timeZones.push("UTC");

  const now = new Date();
  return timeZones
    .map((timeZone) => {
      const offset = new Intl.DateTimeFormat(locale, {
        timeZone,
        timeZoneName: "short",
      })
        .formatToParts(now)
        .find((part) => part.type === "timeZoneName")?.value;
      return {
        value: timeZone,
        label: `${timeZone.replaceAll("_", " ")}${offset ? ` (${offset})` : ""}`,
      };
    })
    .sort((left, right) => left.value.localeCompare(right.value));
}
