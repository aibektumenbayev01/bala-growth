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

export type GrowthPredictionPoint = {
  ageMonths: number;
  date: Date;
  predictedHeight: number;
};

export type GrowthAnomalyFlag =
  | "low_growth_velocity"
  | "percentile_drop"
  | "possible_stunting_risk";

export type GrowthAnomaly = {
  flag: GrowthAnomalyFlag;
  explanation: string;
};

export type GrowthRiskLevel =
  | "normal"
  | "below_expected_growth"
  | "requires_attention";

export type GrowthInsightStatus =
  | "normal_trend"
  | "below_expected_growth"
  | "requires_attention";

export type ChildGrowthInsights = {
  childId: string;
  generatedAt: Date;
  historicalMeasurements: Measurement[];
  predictedPoints: GrowthPredictionPoint[];
  predictionModel: "linear_regression";
  predictionMessage: string | null;
  anomalies: GrowthAnomaly[];
  riskLevel: GrowthRiskLevel;
  status: GrowthInsightStatus;
  summary: string;
  withinExpectedWhoRange: boolean;
  latestPercentileBand: string;
  latestZScore: number | null;
  annualizedGrowthVelocity: number | null;
  disclaimer: string;
};