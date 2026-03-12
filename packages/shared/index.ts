export type Gender = "male" | "female";

export type Child = {
  id: string;
  name: string;
  gender: Gender;
  birthDate: Date;
};

export type Measurement = {
  id: string;
  childId: string;
  date: Date;
  height: number; // рост в см
  weight: number; // вес в кг
};