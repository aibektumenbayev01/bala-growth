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
    .filter((m) => Number.isFinite(m.height))
    .sort((a, b) => a.ageMonths - b.ageMonths);
}

export function prepareChartData(
  whoData: WhoHeightPoint[],
  childMeasurements: ChildHeightMeasurementPoint[]
): GrowthChartPoint[] {
  return whoData.map((row) => {
    const measurement = childMeasurements.find(
      (m) => Math.abs(m.ageMonths - row.ageMonths) <= 2
    );

    return {
      ageMonths: row.ageMonths,
      p3: row.p3,
      p15: row.p15,
      p50: row.p50,
      p85: row.p85,
      p97: row.p97,
      childHeight: measurement ? measurement.height : null,
    };
  });
}

export function getNearestWhoRow(
  whoData: WhoHeightPoint[],
  ageMonths: number
): WhoHeightPoint | null {
  if (whoData.length === 0) return null;

  let nearest = whoData[0];
  let minDiff = Math.abs(whoData[0].ageMonths - ageMonths);

  for (const row of whoData) {
    const diff = Math.abs(row.ageMonths - ageMonths);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = row;
    }
  }

  return nearest;
}

export function getHeightPercentileBand(
  height: number,
  whoRow: WhoHeightPoint | null
): string {
  if (!whoRow || !Number.isFinite(height)) return "—";

  if (height < whoRow.p3) return "<3rd";
  if (height < whoRow.p15) return "3rd–15th";
  if (height < whoRow.p50) return "15th–50th";
  if (height < whoRow.p85) return "50th–85th";
  if (height < whoRow.p97) return "85th–97th";
  return ">97th";
}