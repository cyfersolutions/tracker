export type RoofSizeUnit = "sqft" | "sqm";

const SQFT_PER_SQM = 10.7639;

export function toSquareFeet(value: number, unit: RoofSizeUnit) {
  return unit === "sqm" ? value * SQFT_PER_SQM : value;
}

export function fromSquareFeet(value: number, unit: RoofSizeUnit) {
  return unit === "sqm" ? value / SQFT_PER_SQM : value;
}
