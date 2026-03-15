// данные для девочек от 5 до 19 лет.
export type WhoHeightPoint = {
  ageMonths: number;
  p3: number;
  p15: number;
  p50: number;
  p85: number;
  p97: number;
};

export const hfaGirls5to19: WhoHeightPoint[] = [
  { ageMonths: 60, p3: 99.9, p15: 103.8, p50: 109.4, p85: 115.0, p97: 118.9 },
  { ageMonths: 72, p3: 105.4, p15: 109.7, p50: 116.0, p85: 122.3, p97: 126.6 },
  { ageMonths: 84, p3: 110.7, p15: 115.4, p50: 122.3, p85: 129.3, p97: 134.1 },
  { ageMonths: 96, p3: 116.0, p15: 121.1, p50: 128.6, p85: 136.2, p97: 141.4 },
  { ageMonths: 108, p3: 121.3, p15: 126.9, p50: 135.1, p85: 143.4, p97: 149.1 },
  { ageMonths: 120, p3: 126.7, p15: 132.8, p50: 141.7, p85: 150.8, p97: 157.1 },
  { ageMonths: 132, p3: 132.3, p15: 139.1, p50: 148.6, p85: 158.4, p97: 165.2 },
  { ageMonths: 144, p3: 137.9, p15: 145.2, p50: 155.1, p85: 165.3, p97: 172.4 }
];