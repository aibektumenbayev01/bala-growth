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
  height: 188; // рост в см
  weight: 54; // вес в кг
};