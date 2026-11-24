// Editable lookup tables for known data-quality issues in RMI.
// The original value is always kept in the report; these only feed the *_norm columns used by the dashboard.
// Keys are matched case-insensitively after trimming and collapsing spaces.

export const DISPLAYED_WHERE: Record<string, string> = {
  cassettee: "Cassette",
  cassette: "Cassette",
  "tile stand": "Tile Stand",
  slanter: "Slanter",
  mockup: "Mock-up",
  "mock up": "Mock-up",
};

export const CASSETTE_TYPE: Record<string, string> = {
  "horizotal 45 degree": "Horizontal 45 Degree", // typo in RMI master data
  "horizontal 45 degree": "Horizontal 45 Degree",
  "vertical slider": "Vertical Slider",
  "wall - book type": "Wall - Book Type",
};

export const PRODUCT_TYPE: Record<string, string> = {
  "glazed vitrified tiles": "Glazed Vitrified Tiles",
  "ceramic wall": "Ceramic Wall",
  "ceramic floor": "Ceramic Floor",
  "vitrified dch": "Vitrified DCH",
  "vitrified sst": "Vitrified SST",
  "vitrified heavy duty": "Vitrified Heavy Duty",
  "vitrified elevation": "Vitrified Elevation",
  "full body vitrified": "Full Body Vitrified",
  "ext floor": "Exterior Floor",
};

/** Panel sizes that the parser can't handle on its own. Value null = "Unknown". */
export const PANEL_SIZE_OVERRIDES: Record<string, string | null> = {
  "0": null,
  "3": null,
};

export function lookupKey(v: string | null | undefined): string {
  return (v ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}
