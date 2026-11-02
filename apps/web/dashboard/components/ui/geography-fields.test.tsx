import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("countrycitystatejson/client", () => ({
  getCountries: () => [
    { shortName: "CD", name: "Democratic Republic of the Congo", emoji: "🇨🇩", phone:"243" },
    { shortName: "BE", name: "Belgium", emoji: "🇧🇪", phone:"32" },
  ],
  getCountryByShort: async (country: string) => country === "CD"
    ? { states: { Kinshasa: [{ name: "Kinshasa" }], "Kongo Central": [{ name: "Matadi" }] } }
    : { states: { Brussels: [{ name: "Brussels" }] } },
}));

import { GeographyFields,FormGeographyFields,PhoneField } from "./geography-fields";

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
  it('keeps country selection required with the searchable flag picker',async()=>{
    const user=userEvent.setup();
    render(<form data-testid="required-country"><FormGeographyFields required searchableCountry showCity={false} countryCodeName="country_code" className="field"/></form>);
    const form=screen.getByTestId('required-country') as HTMLFormElement;
    act(()=>{expect(form.checkValidity()).toBe(false);});
    expect(screen.getByRole('button',{name:'Pays'})).toHaveAttribute('aria-expanded','true');
    await user.click(screen.getByRole('option',{name:'Belgique'}));
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get('country_code')).toBe('BE');
  });
  it('searches phone prefixes with graphical flags and preserves the entered number when changing prefix',async()=>{
    const user=userEvent.setup();
    const {container}=render(<form data-testid="phone-form"><PhoneField defaultValue="+243900123456" className="field"/></form>);
    expect(screen.getByLabelText('Numéro de téléphone')).toHaveValue('900123456');
    expect(container.querySelector('.fi-cd')).toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Indicatif du pays'}));
    await user.type(screen.getByRole('combobox',{name:'Rechercher un pays'}),'32');
    await user.click(screen.getByRole('option',{name:'Belgique (+32)'}));
    expect(container.querySelector('.fi-be')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Indicatif du pays'})).toHaveTextContent('+32');
    expect(new FormData(screen.getByTestId('phone-form') as HTMLFormElement).get('phone')).toBe('+32900123456');
  });
  it('lets an agency search countries with flags without changing the stored country name',async()=>{
    const user=userEvent.setup();
    const {container}=render(<form data-testid="country-form"><FormGeographyFields searchableCountry className="field"/></form>);
    await user.click(screen.getByRole('button',{name:'Pays'}));
    await user.type(screen.getByRole('combobox',{name:'Rechercher un pays'}),'Belg');
    await user.click(screen.getByRole('option',{name:'Belgique'}));
    expect(container.querySelector('.fi-be')).toBeInTheDocument();
    expect(new FormData(screen.getByTestId('country-form') as HTMLFormElement).get('country')).toBe('Belgium');
  });
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
