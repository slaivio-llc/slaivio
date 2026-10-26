import { describe, expect, it } from "vitest";
import { formatOfficeDisplayName, formatOrganizationDisplayName, formatWarehouseDisplayName } from "./organization-switcher";

describe("Noms des espaces",()=>{
  it("préserve le nom de l’agence et sa casse",()=>{
    expect(formatOrganizationDisplayName("  Cargo   Express  ")).toBe("Cargo Express");
    expect(formatOfficeDisplayName("Kinshasa")).toBe("Kinshasa");
    expect(formatWarehouseDisplayName("Guangzhou")).toBe("Guangzhou");
  });
  it("ne réaffiche pas les anciens suffixes anglais",()=>{
    expect(formatOfficeDisplayName("Kinshasa's office")).toBe("Kinshasa");
    expect(formatWarehouseDisplayName("Guangzhou'S WAREHOUSE")).toBe("Guangzhou");
    expect(formatOrganizationDisplayName("Cargo Express's org")).toBe("Cargo Express");
  });
  it("utilise des libellés français lorsque le nom manque",()=>{
    expect(formatOrganizationDisplayName(null)).toBe("Agence");
    expect(formatOfficeDisplayName(" ")).toBe("Bureau");
    expect(formatWarehouseDisplayName()).toBe("Entrepôt");
  });
});
