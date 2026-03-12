import type { Child, Measurement } from "@bala/shared";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

// даты в JSON приходят строками
type ChildDTO = Omit<Child, "birthDate"> & { birthDate: string };
type MeasurementDTO = Omit<Measurement, "date"> & { date: string };

function parseApiDate(value: string): Date {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }

  return new Date(value);
}

function toChild(dto: ChildDTO): Child {
  return { ...dto, birthDate: parseApiDate(dto.birthDate) };
}

function toMeasurement(dto: MeasurementDTO): Measurement {
  return { ...dto, date: parseApiDate(dto.date) };
}

export async function getChildren(): Promise<Child[]> {
  const res = await fetch(`${API_BASE}/children`);
  if (!res.ok) throw new Error("Failed to load children");
  const data: ChildDTO[] = await res.json();
  return data.map(toChild);
}

export async function createChild(input: {
  name: string;
  gender: "male" | "female";
  birthDate: Date;
}): Promise<Child> {
  const res = await fetch(`${API_BASE}/children`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      gender: input.gender,
      birthDate: input.birthDate.toISOString(),
    }),
  });

  if (!res.ok) throw new Error("Failed to create child");
  const dto: ChildDTO = await res.json();
  return toChild(dto);
}

export async function getMeasurements(childId: string): Promise<Measurement[]> {
  const res = await fetch(`${API_BASE}/children/${childId}/measurements`);
  if (!res.ok) throw new Error("Failed to load measurements");
  const data: MeasurementDTO[] = await res.json();
  return data.map(toMeasurement);
}

export async function deleteMeasurement(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/measurements/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) throw new Error("Failed to delete measurement");
}

export async function createMeasurement(
  childId: string,
  input: { date: Date; height: number; weight: number }
): Promise<Measurement> {
  const res = await fetch(`${API_BASE}/children/${childId}/measurements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: input.date.toISOString(),
      height: input.height,
      weight: input.weight,
    }),
  });

  if (!res.ok) throw new Error("Failed to create measurement");
  const dto: MeasurementDTO = await res.json();
  return toMeasurement(dto);
}