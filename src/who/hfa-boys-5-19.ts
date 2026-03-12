// данные для мальчиков от 5 до 19 лет.
export type WhoHeightPoint = {
  ageMonths: number
  p3: number
  p15: number
  p50: number
  p85: number
  p97: number
}

export const hfaBoys5to19 = [
  { ageMonths: 60, p3: 100.7, p15: 104.4, p50: 110.0, p85: 115.6, p97: 119.2 },
  { ageMonths: 72, p3: 106.1, p15: 110.2, p50: 116.0, p85: 121.9, p97: 125.8 },
  { ageMonths: 84, p3: 111.2, p15: 115.6, p50: 121.7, p85: 128.0, p97: 132.2 },
  { ageMonths: 96, p3: 116.0, p15: 120.8, p50: 127.3, p85: 133.9, p97: 138.4 },
  { ageMonths: 108, p3: 120.5, p15: 125.7, p50: 132.7, p85: 139.7, p97: 144.5 },
  { ageMonths: 120, p3: 125.0, p15: 130.6, p50: 138.0, p85: 145.5, p97: 150.5 },
  { ageMonths: 132, p3: 129.2, p15: 135.3, p50: 143.2, p85: 151.2, p97: 156.4 },
  { ageMonths: 144, p3: 133.5, p15: 140.3, p50: 149.1, p85: 157.8, p97: 163.7 }
];