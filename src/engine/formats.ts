// Can formats from docs/can-reference.md. Diameters and heights are published values;
// fields marked `assumed` in the comments are visual modelling values to replace with
// caliper measurements when a real sample is available.

export type BodyFamily = "standard" | "sleek" | "slim" | "longfit" | "mega" | "crowler";
export type Region = "UK/EU" | "US";
export type EndSize = "200" | "202" | "300";
/** S = seamed, F = flanged/open, C = catalogue (datum unspecified). */
export type HeightBasis = "S" | "F" | "C";

export interface EndSpec {
  size: EndSize;
  /** Finished seam outside diameter. Assumed for all sizes: no universal published value. */
  rimDiameter: number;
  /** Inside fitting diameter at the neck. */
  plugDiameter: number;
  /** From the top of the seam to the bottom of the countersink trough. */
  countersinkDepth: number;
  /** Centre panel height above the trough. */
  panelRise: number;
  seamHeight: number;
}

export const ENDS: Record<EndSize, EndSpec> = {
  "200": { size: "200", rimDiameter: 51.6, plugDiameter: 50.0, countersinkDepth: 6.35, panelRise: 2.08, seamHeight: 2.5 },
  "202": { size: "202", rimDiameter: 54.0, plugDiameter: 52.4, countersinkDepth: 6.35, panelRise: 2.08, seamHeight: 2.5 },
  // 300 end: plug from the Ball/Saxco Crowler drawing; rim assumed.
  "300": { size: "300", rimDiameter: 76.4, plugDiameter: 72.69, countersinkDepth: 6.6, panelRise: 2.2, seamHeight: 2.7 }
};

export interface CanFormat {
  id: string;
  /** Short display name, e.g. "440 ml". */
  name: string;
  family: BodyFamily;
  region: Region;
  capacityMl: number;
  /** Secondary capacity label, e.g. "16 fl oz". */
  capacityAlt?: string;
  supplier: string;
  bodyDiameter: number;
  height: number;
  heightBasis: HeightBasis;
  /** Overall neck height: shoulder start to seam. Published for Ardagh standard/sleek, else assumed. */
  neckHeight: number;
  /** Standing-ring diameter. Published for Ardagh standard and Ball 12 oz, else assumed. */
  standDiameter: number;
  end: EndSize;
  /** Supplier print template (artwork canvas) when published. */
  artwork?: { width: number; height: number };
}

export const FORMATS: CanFormat[] = [
  // UK/EU standard, 66 mm body
  { id: "eu-std-330", name: "330 ml", family: "standard", region: "UK/EU", capacityMl: 330, supplier: "Ardagh", bodyDiameter: 66.3, height: 115.2, heightBasis: "S", neckHeight: 19, standDiameter: 48.3, end: "202", artwork: { width: 207, height: 107 } },
  { id: "eu-std-440", name: "440 ml", family: "standard", region: "UK/EU", capacityMl: 440, supplier: "Ardagh", bodyDiameter: 66.3, height: 149.9, heightBasis: "S", neckHeight: 20, standDiameter: 48.3, end: "202", artwork: { width: 206, height: 141.4 } },
  { id: "eu-std-500", name: "500 ml", family: "standard", region: "UK/EU", capacityMl: 500, supplier: "Ardagh", bodyDiameter: 66.3, height: 168.0, heightBasis: "S", neckHeight: 20, standDiameter: 48.3, end: "202", artwork: { width: 206, height: 160 } },
  { id: "eu-std-550", name: "550 ml", family: "standard", region: "UK/EU", capacityMl: 550, supplier: "CANPACK", bodyDiameter: 66.3, height: 182.65, heightBasis: "C", neckHeight: 20, standDiameter: 48.3, end: "202" },
  { id: "eu-std-568", name: "568 ml", family: "standard", region: "UK/EU", capacityMl: 568, capacityAlt: "1 imperial pint", supplier: "CANPACK", bodyDiameter: 66.3, height: 188.09, heightBasis: "C", neckHeight: 20, standDiameter: 48.3, end: "202", artwork: { width: 206, height: 180 } },
  { id: "eu-std-237", name: "237 ml", family: "standard", region: "UK/EU", capacityMl: 237, capacityAlt: "8 fl oz", supplier: "Crown", bodyDiameter: 66, height: 88.05, heightBasis: "C", neckHeight: 19, standDiameter: 48.3, end: "202" },
  { id: "eu-std-250", name: "250 ml", family: "standard", region: "UK/EU", capacityMl: 250, supplier: "Crown", bodyDiameter: 66, height: 91.69, heightBasis: "C", neckHeight: 19, standDiameter: 48.3, end: "202" },
  { id: "eu-std-300", name: "300 ml", family: "standard", region: "UK/EU", capacityMl: 300, supplier: "Crown", bodyDiameter: 66, height: 106.3, heightBasis: "C", neckHeight: 19, standDiameter: 48.3, end: "202" },
  { id: "eu-longfit-449", name: "449 ml Long Fit", family: "longfit", region: "UK/EU", capacityMl: 449, supplier: "CANPACK", bodyDiameter: 63.5, height: 168, heightBasis: "C", neckHeight: 16, standDiameter: 46.5, end: "202" },

  // Sleek / Fit, 58 mm body
  { id: "eu-sleek-200", name: "200 ml", family: "sleek", region: "UK/EU", capacityMl: 200, supplier: "CANPACK Fit", bodyDiameter: 58.1, height: 95.2, heightBasis: "C", neckHeight: 10, standDiameter: 44, end: "202" },
  { id: "eu-sleek-250", name: "250 ml", family: "sleek", region: "UK/EU", capacityMl: 250, supplier: "Ball", bodyDiameter: 58.1, height: 113.9, heightBasis: "F", neckHeight: 10, standDiameter: 44, end: "202" },
  { id: "eu-sleek-300", name: "300 ml", family: "sleek", region: "UK/EU", capacityMl: 300, supplier: "CANPACK Fit", bodyDiameter: 58.1, height: 132.89, heightBasis: "C", neckHeight: 10, standDiameter: 44, end: "202" },
  { id: "eu-sleek-330", name: "330 ml", family: "sleek", region: "UK/EU", capacityMl: 330, supplier: "Ardagh, 202 neck", bodyDiameter: 58.1, height: 145.4, heightBasis: "S", neckHeight: 10, standDiameter: 44, end: "202", artwork: { width: 181, height: 139 } },
  { id: "eu-sleek-330-200", name: "330 ml, 200 neck", family: "sleek", region: "UK/EU", capacityMl: 330, supplier: "NOMOQ, 200 neck", bodyDiameter: 58.1, height: 145.4, heightBasis: "S", neckHeight: 12, standDiameter: 44, end: "200", artwork: { width: 181, height: 139 } },
  { id: "eu-sleek-355", name: "355 ml", family: "sleek", region: "UK/EU", capacityMl: 355, supplier: "CANPACK Fit", bodyDiameter: 58.1, height: 156.9, heightBasis: "C", neckHeight: 10, standDiameter: 44, end: "202" },

  // Slim, 53 mm body
  { id: "eu-slim-150", name: "150 ml", family: "slim", region: "UK/EU", capacityMl: 150, supplier: "CANPACK", bodyDiameter: 53.4, height: 88.4, heightBasis: "C", neckHeight: 7, standDiameter: 40.5, end: "200", artwork: { width: 166, height: 83.3 } },
  { id: "eu-slim-185", name: "185 ml", family: "slim", region: "UK/EU", capacityMl: 185, supplier: "CANPACK", bodyDiameter: 53.4, height: 103.38, heightBasis: "C", neckHeight: 7, standDiameter: 40.5, end: "200" },
  { id: "eu-slim-200", name: "200 ml", family: "slim", region: "UK/EU", capacityMl: 200, supplier: "Ardagh", bodyDiameter: 53.4, height: 111.2, heightBasis: "S", neckHeight: 7, standDiameter: 40.5, end: "200" },
  { id: "eu-slim-240", name: "240 ml", family: "slim", region: "UK/EU", capacityMl: 240, supplier: "Crown", bodyDiameter: 53, height: 129.5, heightBasis: "C", neckHeight: 7, standDiameter: 40.5, end: "200" },
  { id: "eu-slim-250", name: "250 ml", family: "slim", region: "UK/EU", capacityMl: 250, supplier: "Ardagh", bodyDiameter: 53.4, height: 134.0, heightBasis: "S", neckHeight: 7, standDiameter: 40.5, end: "200", artwork: { width: 166, height: 130 } },
  { id: "eu-slim-250-crown", name: "250 ml (Crown)", family: "slim", region: "UK/EU", capacityMl: 250, supplier: "Crown", bodyDiameter: 53, height: 133, heightBasis: "C", neckHeight: 7, standDiameter: 40.5, end: "200" },

  // US
  { id: "us-sleek-7.5", name: "7.5 oz sleek", family: "sleek", region: "US", capacityMl: 222, capacityAlt: "7.5 fl oz", supplier: "Ball", bodyDiameter: 57.3, height: 103.84, heightBasis: "F", neckHeight: 10, standDiameter: 44, end: "202" },
  { id: "us-std-12", name: "12 oz", family: "standard", region: "US", capacityMl: 355, capacityAlt: "12 fl oz", supplier: "Ball", bodyDiameter: 66.04, height: 122.22, heightBasis: "F", neckHeight: 18.97, standDiameter: 47.35, end: "202" },
  { id: "us-sleek-12", name: "12 oz sleek", family: "sleek", region: "US", capacityMl: 355, capacityAlt: "12 fl oz", supplier: "Ball", bodyDiameter: 57.37, height: 155.63, heightBasis: "F", neckHeight: 10, standDiameter: 44, end: "202" },
  { id: "us-std-16", name: "16 oz", family: "standard", region: "US", capacityMl: 473, capacityAlt: "16 fl oz", supplier: "Ball / Crown", bodyDiameter: 66.04, height: 157.23, heightBasis: "F", neckHeight: 20, standDiameter: 47.35, end: "202" },
  { id: "us-std-19.2", name: "19.2 oz", family: "standard", region: "US", capacityMl: 568, capacityAlt: "19.2 fl oz", supplier: "Ball / Saxco", bodyDiameter: 65.9, height: 188.1, heightBasis: "F", neckHeight: 20, standDiameter: 47.35, end: "202" },
  { id: "us-mega-24", name: "24 oz Mega", family: "mega", region: "US", capacityMl: 710, capacityAlt: "24 fl oz", supplier: "CANPACK", bodyDiameter: 73, height: 193.29, heightBasis: "C", neckHeight: 26, standDiameter: 53, end: "202" },
  { id: "us-crowler-32", name: "32 oz Crowler", family: "crowler", region: "US", capacityMl: 946, capacityAlt: "32 fl oz", supplier: "Ball / Saxco", bodyDiameter: 83.59, height: 193.14, heightBasis: "F", neckHeight: 9, standDiameter: 64, end: "300" }
];

export const DEFAULT_FORMAT_ID = "eu-std-440";

export const FAMILY_LABELS: Record<BodyFamily, string> = {
  standard: "Standard",
  sleek: "Sleek",
  slim: "Slim",
  longfit: "Long Fit",
  mega: "Mega",
  crowler: "Crowler"
};

export function getFormat(id: string): CanFormat {
  return FORMATS.find((format) => format.id === id) ?? FORMATS.find((format) => format.id === DEFAULT_FORMAT_ID)!;
}
