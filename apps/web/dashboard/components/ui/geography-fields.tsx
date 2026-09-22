"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import {
  getCountries,
  getCountryByShort,
} from "countrycitystatejson/client";

type GeoCountry = ReturnType<typeof getCountries>[number] & {
  name: string;
  emoji: string;
};

const countries = getCountries().filter(
  (country): country is GeoCountry => Boolean(country.shortName && country.name),
).sort((left, right) =>
  left.name.localeCompare(right.name, "fr", { sensitivity: "base" }),
);

function resolveCountry(value: string) {
  const normalized = value.trim().toLocaleLowerCase("fr");
  return countries.find(
    (country) =>
      country.shortName.toLocaleLowerCase("fr") === normalized ||
      country.name.toLocaleLowerCase("fr") === normalized,
  );
}

function storedCountry(country: GeoCountry, mode: "name" | "isoCode") {
  return mode === "isoCode" ? country.shortName : country.name;
}

export function GeographyFields({
  country,
  city,
  onCountryChange,
  onCityChange,
  countryName = "country",
  countryCodeName,
  cityName = "city",
  countryValueMode = "name",
  required = false,
  cityRequired = required,
  className,
  fieldClassName = "grid gap-1.5 text-[13px] font-medium text-[#344049]",
  countryLabel = "Pays",
  cityLabel = "Ville",
  showCity = true,
}: {
  country: string;
  city: string;
  onCountryChange?: (value: string) => void;
  onCityChange?: (value: string) => void;
  countryName?: string;
  countryCodeName?: string;
  cityName?: string;
  countryValueMode?: "name" | "isoCode";
  required?: boolean;
  cityRequired?: boolean;
  className: string;
  fieldClassName?: string;
  countryLabel?: string;
  cityLabel?: string;
  showCity?: boolean;
}) {
  const selectedCountry = useMemo(() => resolveCountry(country), [country]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const knownCity = !city || availableCities.includes(city);
  const [customCity, setCustomCity] = useState(Boolean(city && !knownCity));

  useEffect(() => {
    let active = true;
    if (!selectedCountry || !showCity) {
      setAvailableCities([]);
      setCitiesLoading(false);
      return () => { active = false; };
    }
    setCitiesLoading(true);
    getCountryByShort(selectedCountry.shortName)
      .then((countryData) => {
        if (!active) return;
        const cityNames = Object.values(countryData?.states || {}).flatMap((cities) =>
          cities.map((item) => item.name),
        );
        setAvailableCities(
          Array.from(new Set(cityNames)).sort((left, right) =>
            left.localeCompare(right, "fr", { sensitivity: "base" }),
          ),
        );
      })
      .catch(() => {
        if (active) setAvailableCities([]);
      })
      .finally(() => {
        if (active) setCitiesLoading(false);
      });
    return () => { active = false; };
  }, [selectedCountry, showCity]);

  useEffect(() => {
    setCustomCity(Boolean(city && !availableCities.includes(city)));
  }, [availableCities, city]);

  function chooseCountry(isoCode: string) {
    const next = countries.find((item) => item.shortName === isoCode);
    onCountryChange?.(next ? storedCountry(next, countryValueMode) : "");
    onCityChange?.("");
    setCustomCity(false);
  }

  function chooseCity(value: string) {
    if (value === "__CUSTOM__") {
      setCustomCity(true);
      onCityChange?.("");
      return;
    }
    setCustomCity(false);
    onCityChange?.(value);
  }

  const countrySelectValue = selectedCountry?.shortName || (country ? "__LEGACY__" : "");
  return (
    <>
      <label className={fieldClassName}>
        <span>{countryLabel}{required ? " *" : ""}</span>
        <input type="hidden" name={countryName} value={country} />
        {countryCodeName && <input type="hidden" name={countryCodeName} value={selectedCountry?.shortName || ""} />}
        <select
          required={required}
          aria-label={countryLabel}
          className={className}
          value={countrySelectValue}
          onChange={(event) => chooseCountry(event.target.value)}
        >
          <option value="">Choisir un pays</option>
          {!selectedCountry && country && <option value="__LEGACY__">{country}</option>}
          {countries.map((item) => (
            <option key={item.shortName} value={item.shortName}>
              {item.emoji} {item.name}
            </option>
          ))}
        </select>
      </label>
      {showCity && <label className={fieldClassName}>
        <span>{cityLabel}{cityRequired ? " *" : ""}</span>
        <input type="hidden" name={cityName} value={city} />
        {customCity ? (
          <div className="flex gap-2">
            <input
              required={cityRequired}
              className={className}
              value={city}
              onChange={(event) => onCityChange?.(event.target.value)}
              placeholder="Saisir une ville absente de la liste"
              autoComplete="address-level2"
            />
            <button
              type="button"
              className="shrink-0 rounded-[7px] px-3 text-[12px] font-medium text-[#59656e] hover:bg-[#f3f5f6]"
              onClick={() => { setCustomCity(false); onCityChange?.(""); }}
            >
              Liste
            </button>
          </div>
        ) : (
          <select
            required={cityRequired}
            aria-label={cityLabel}
            className={className}
            value={knownCity ? city : ""}
            disabled={!selectedCountry || citiesLoading}
            onChange={(event) => chooseCity(event.target.value)}
          >
            <option value="">
              {citiesLoading
                ? "Chargement des villes…"
                : selectedCountry
                  ? "Choisir une ville"
                  : "Choisissez d’abord un pays"}
            </option>
            {availableCities.map((name) => <option key={name} value={name}>{name}</option>)}
            {selectedCountry && !citiesLoading && <option value="__CUSTOM__">Autre ville…</option>}
          </select>
        )}
      </label>}
    </>
  );
}

export function FormGeographyFields({
  initialCountry = "",
  initialCity = "",
  ...props
}: Omit<ComponentProps<typeof GeographyFields>, "country" | "city" | "onCountryChange" | "onCityChange"> & {
  initialCountry?: string;
  initialCity?: string;
}) {
  const [country, setCountry] = useState(initialCountry);
  const [city, setCity] = useState(initialCity);
  return <GeographyFields {...props} country={country} city={city} onCountryChange={setCountry} onCityChange={setCity} />;
}

export function PhoneField({name="phone",defaultValue="",initialCountry="",className}:{name?:string;defaultValue?:string;initialCountry?:string;className:string}) {
  const initial=resolveCountry(initialCountry);
  const normalized=defaultValue.replace(/[^0-9+]/g,"");
  const matched=[...countries].filter(country=>normalized.startsWith(`+${country.phone||""}`)).sort((left,right)=>(right.phone?.length||0)-(left.phone?.length||0))[0];
  const [countryCode,setCountryCode]=useState(matched?.shortName||initial?.shortName||"");
  const current=countries.find(country=>country.shortName===countryCode);
  const initialDial=matched?.phone||initial?.phone||"";
  const [national,setNational]=useState(normalized.replace(new RegExp(`^\\+?${initialDial}`),"").replace(/^0+/,""));
  const phone=current?.phone&&national?`+${current.phone}${national.replace(/\D/g,"")}`:"";
  return <div className="grid grid-cols-[132px_1fr] gap-2"><input type="hidden" name={name} value={phone}/><select aria-label="Indicatif du pays" className={className} value={countryCode} onChange={event=>{setCountryCode(event.target.value);setNational("");}}><option value="">Indicatif</option>{countries.map(country=><option key={country.shortName} value={country.shortName}>{country.emoji} +{country.phone}</option>)}</select><input aria-label="Numéro de téléphone" inputMode="tel" autoComplete="tel-national" className={className} value={national} onChange={event=>setNational(event.target.value.replace(/\D/g,""))} placeholder="Numéro sans indicatif"/></div>;
}
