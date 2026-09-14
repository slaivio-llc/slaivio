import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("countrycitystatejson/client", () => ({
  getCountries: () => [
    { shortName: "CD", name: "Democratic Republic of the Congo", emoji: "🇨🇩" },
    { shortName: "BE", name: "Belgium", emoji: "🇧🇪" },
  ],
  getCountryByShort: async (country: string) => country === "CD"
    ? { states: { Kinshasa: [{ name: "Kinshasa" }], "Kongo Central": [{ name: "Matadi" }] } }
    : { states: { Brussels: [{ name: "Brussels" }] } },
}));

import { GeographyFields } from "./geography-fields";

function Harness() {
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  return (
    <form data-testid="form">
      <GeographyFields
        required
        country={country}
        city={city}
        onCountryChange={setCountry}
        onCityChange={setCity}
        className="field"
      />
    </form>
  );
}

describe("GeographyFields", () => {
  it("propose seulement les villes du pays sélectionné et conserve les valeurs métier", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Pays"), "CD");
    await waitFor(() => expect(screen.getByRole("option", { name: "Kinshasa" })).toBeInTheDocument());
    expect(screen.queryByRole("option", { name: "Brussels" })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Ville"), "Kinshasa");
    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(new FormData(form).get("country")).toBe("Democratic Republic of the Congo");
    expect(new FormData(form).get("city")).toBe("Kinshasa");
  });
});
