export type WhoHeightPoint = {
  ageMonths: number;
  p3: number;
  p15: number;
  p50: number;
  p85: number;
  p97: number;
};

export type ChildHeightMeasurementPoint = {
  ageMonths: number;
  height: number;
};

export type GrowthChartPoint = {
  ageMonths: number;
  p3: number;
  p15: number;
  p50: number;
  p85: number;
  p97: number;
  childHeight: number | null;
};

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function toSafeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeWhoRow(row: WhoHeightPoint): WhoHeightPoint {
  return {
    ageMonths: toSafeNumber(row.ageMonths),
    p3: toSafeNumber(row.p3),
    p15: toSafeNumber(row.p15),
    p50: toSafeNumber(row.p50),
    p85: toSafeNumber(row.p85),
    p97: toSafeNumber(row.p97),
  };
}

export function getAgeInMonths(
  birthDateValue: string | Date,
  measureDateValue: string | Date
): number {
  const birthDate = toDate(birthDateValue);
  const measureDate = toDate(measureDateValue);

  const years = measureDate.getFullYear() - birthDate.getFullYear();
  const months = measureDate.getMonth() - birthDate.getMonth();

  let total = years * 12 + months;

  if (measureDate.getDate() < birthDate.getDate()) {
    total -= 1;
  }

  return Math.max(total, 0);
}

export function prepareChildHeightMeasurements(
  birthDateValue: string | Date,
  measurements: Array<{ date: string | Date; height: number }>
): ChildHeightMeasurementPoint[] {
  return measurements
    .map((m) => ({
      ageMonths: getAgeInMonths(birthDateValue, m.date),
      height: Number(m.height),
    }))
    .filter(
      (m) =>
        Number.isFinite(m.ageMonths) &&
        Number.isFinite(m.height) &&
        m.height > 0
    )
    .sort((a, b) => a.ageMonths - b.ageMonths);
}

export function getNearestWhoRow(
  whoData: WhoHeightPoint[],
  ageMonths: number
): WhoHeightPoint | null {
  if (whoData.length === 0) return null;

  const normalized = whoData.map(normalizeWhoRow);

  let nearest = normalized[0];
  let minDiff = Math.abs(normalized[0].ageMonths - ageMonths);

  for (const row of normalized) {
    const diff = Math.abs(row.ageMonths - ageMonths);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = row;
    }
  }

  return nearest;
}

export function prepareChartData(
  whoData: WhoHeightPoint[],
  childMeasurements: ChildHeightMeasurementPoint[]
): GrowthChartPoint[] {
  const normalizedWho = whoData
    .map(normalizeWhoRow)
    .filter(
      (row) =>
        Number.isFinite(row.ageMonths) &&
        Number.isFinite(row.p3) &&
        Number.isFinite(row.p15) &&
        Number.isFinite(row.p50) &&
        Number.isFinite(row.p85) &&
        Number.isFinite(row.p97)
    )
    .sort((a, b) => a.ageMonths - b.ageMonths);

  if (normalizedWho.length === 0) return [];

  const normalizedChild = childMeasurements
    .map((m) => ({
      ageMonths: Number(m.ageMonths),
      height: Number(m.height),
    }))
    .filter(
      (m) =>
        Number.isFinite(m.ageMonths) &&
        Number.isFinite(m.height) &&
        m.height > 0
    )
    .sort((a, b) => a.ageMonths - b.ageMonths);

  const ageSet = new Set<number>();

  for (const row of normalizedWho) {
    ageSet.add(row.ageMonths);
  }

  for (const m of normalizedChild) {
    ageSet.add(m.ageMonths);
  }

  const mergedAges = Array.from(ageSet).sort((a, b) => a - b);

  return mergedAges.map((ageMonths) => {
    const whoRow = getNearestWhoRow(normalizedWho, ageMonths);
    const childPoint =
      normalizedChild.find((m) => m.ageMonths === ageMonths) ?? null;

    return {
      ageMonths,
      p3: whoRow?.p3 ?? 0,
      p15: whoRow?.p15 ?? 0,
      p50: whoRow?.p50 ?? 0,
      p85: whoRow?.p85 ?? 0,
      p97: whoRow?.p97 ?? 0,
      childHeight: childPoint ? childPoint.height : null,
    };
  });
}

export function getHeightPercentileBand(
  height: number,
  whoRow: WhoHeightPoint | null
): string {
  if (!whoRow || !Number.isFinite(height)) return "—";

  const row = normalizeWhoRow(whoRow);

  if (height < row.p3) return "<3rd";
  if (height < row.p15) return "3rd–15th";
  if (height < row.p50) return "15th–50th";
  if (height < row.p85) return "50th–85th";
  if (height < row.p97) return "85th–97th";
  return ">97th";
}