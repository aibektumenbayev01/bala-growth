const { hfaBoys5to19, hfaGirls5to19 } = require("../data/whoHeight");

const MIN_POINTS_FOR_PREDICTION = 3;
const LOW_GROWTH_VELOCITY_THRESHOLD = 4; // cm/year
const STUNTING_Z_SCORE_THRESHOLD = -2;

function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

function roundToOne(value) {
  return Number(value.toFixed(1));
}

function addMonthsUtc(dateValue, monthsToAdd) {
  const date = toDate(dateValue);
  const next = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + monthsToAdd,
    date.getUTCDate()
  ));
  return next;
}

function getWhoHeightData(gender) {
  return gender === "female" ? hfaGirls5to19 : hfaBoys5to19;
}

function getNearestWhoRow(whoData, ageMonths) {
  if (!whoData.length) return null;

  let nearest = whoData[0];
  let minDiff = Math.abs(nearest.ageMonths - ageMonths);

  for (const row of whoData) {
    const diff = Math.abs(row.ageMonths - ageMonths);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = row;
    }
  }

  return nearest;
}

function getHeightPercentileBand(height, whoRow) {
  if (!whoRow || !Number.isFinite(height)) return "—";

  if (height < whoRow.p3) return "<3rd";
  if (height < whoRow.p15) return "3rd–15th";
  if (height < whoRow.p50) return "15th–50th";
  if (height < whoRow.p85) return "50th–85th";
  if (height < whoRow.p97) return "85th–97th";
  return ">97th";
}

function getPercentileBandRank(percentileBand) {
  const rankMap = {
    "<3rd": 0,
    "3rd–15th": 1,
    "15th–50th": 2,
    "50th–85th": 3,
    "85th–97th": 4,
    ">97th": 5,
  };

  return rankMap[percentileBand] ?? null;
}

function getHeightZScore(height, whoRow) {
  if (!whoRow || !Number.isFinite(height)) return null;

  const sd = (whoRow.p97 - whoRow.p3) / 4;
  if (!Number.isFinite(sd) || sd <= 0) return null;

  const z = (height - whoRow.p50) / sd;
  return Number(z.toFixed(2));
}

function getAgeInMonths(birthDateValue, measureDateValue) {
  const birthDate = toDate(birthDateValue);
  const measureDate = toDate(measureDateValue);

  if (Number.isNaN(birthDate.getTime()) || Number.isNaN(measureDate.getTime())) {
    return 0;
  }

  const years = measureDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const months = measureDate.getUTCMonth() - birthDate.getUTCMonth();

  let total = years * 12 + months;
  if (measureDate.getUTCDate() < birthDate.getUTCDate()) {
    total -= 1;
  }

  return Math.max(total, 0);
}

function fitLinearRegression(points) {
  if (!Array.isArray(points) || points.length < 2) {
    return null;
  }

  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumXX += point.x * point.x;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) {
    const meanY = sumY / n;
    return { slope: 0, intercept: meanY };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

function predictNextMonths(regressionModel, lastAgeMonths, lastMeasurementDate, monthsAhead = 6) {
  if (!regressionModel) return [];

  const points = [];

  for (let monthOffset = 1; monthOffset <= monthsAhead; monthOffset += 1) {
    const ageMonths = lastAgeMonths + monthOffset;
    const predictedHeight = regressionModel.slope * ageMonths + regressionModel.intercept;

    points.push({
      ageMonths,
      date: addMonthsUtc(lastMeasurementDate, monthOffset),
      predictedHeight: roundToOne(Math.max(predictedHeight, 0)),
    });
  }

  return points;
}

function detectGrowthAnomalies({
  timeline,
  whoData,
}) {
  const anomalies = [];
  if (!timeline.length) {
    return {
      anomalies,
      annualizedGrowthVelocity: null,
      latestPercentileBand: "—",
      latestZScore: null,
      withinExpectedWhoRange: true,
    };
  }

  const latest = timeline.at(-1);
  const previous = timeline.length > 1 ? timeline.at(-2) : null;

  const latestWhoRow = getNearestWhoRow(whoData, latest.ageMonths);
  const latestZScore = getHeightZScore(latest.height, latestWhoRow);
  const latestPercentileBand = getHeightPercentileBand(latest.height, latestWhoRow);

  let annualizedGrowthVelocity = null;
  if (previous) {
    const monthsDiff = latest.ageMonths - previous.ageMonths;
    const heightDiff = latest.height - previous.height;
    if (monthsDiff > 0) {
      annualizedGrowthVelocity = Number(((heightDiff / monthsDiff) * 12).toFixed(1));
    }
  }

  if (
    annualizedGrowthVelocity !== null &&
    annualizedGrowthVelocity < LOW_GROWTH_VELOCITY_THRESHOLD
  ) {
    anomalies.push({
      flag: "low_growth_velocity",
      explanation:
        "Annualized growth velocity is lower than expected for age; trend should be monitored.",
    });
  }

  if (previous) {
    const previousWhoRow = getNearestWhoRow(whoData, previous.ageMonths);
    const previousPercentileBand = getHeightPercentileBand(previous.height, previousWhoRow);

    const previousBandRank = getPercentileBandRank(previousPercentileBand);
    const latestBandRank = getPercentileBandRank(latestPercentileBand);

    if (
      previousBandRank !== null &&
      latestBandRank !== null &&
      previousBandRank - latestBandRank >= 2
    ) {
      anomalies.push({
        flag: "percentile_drop",
        explanation:
          "Recent measurements show a meaningful drop in percentile band relative to WHO references.",
      });
    } else {
      const monthsDiff = latest.ageMonths - previous.ageMonths;
      const heightDiff = latest.height - previous.height;
      if (monthsDiff >= 4 && heightDiff <= 0.2) {
        anomalies.push({
          flag: "percentile_drop",
          explanation:
            "Height gain appears close to stagnation across recent months and may require follow-up.",
        });
      }
    }
  }

  if (latestZScore !== null && latestZScore < STUNTING_Z_SCORE_THRESHOLD) {
    anomalies.push({
      flag: "possible_stunting_risk",
      explanation:
        "Current height-for-age z-score is below -2 based on WHO reference curves.",
    });
  }

  return {
    anomalies,
    annualizedGrowthVelocity,
    latestPercentileBand,
    latestZScore,
    withinExpectedWhoRange: latestZScore === null ? true : latestZScore >= -2,
  };
}

function buildPredictionTrendText(predictedPoints, predictionMessage) {
  if (predictionMessage) return predictionMessage;
  if (predictedPoints.length < 2) return "Prediction available with limited future points.";

  const first = predictedPoints[0].predictedHeight;
  const last = predictedPoints[predictedPoints.length - 1].predictedHeight;
  const delta = Number((last - first).toFixed(1));

  if (delta > 1.5) {
    return `Predicted height trend is upward over the next 6 months (+${delta} cm).`;
  }

  if (delta >= 0) {
    return `Predicted height trend appears stable over the next 6 months (+${delta} cm).`;
  }

  return `Predicted height trend is below expected progression over the next 6 months (${delta} cm).`;
}

function generateGrowthInsight({
  anomalies,
  predictedPoints,
  predictionMessage,
  withinExpectedWhoRange,
  latestPercentileBand,
  latestZScore,
}) {
  const flags = new Set(anomalies.map((item) => item.flag));

  let riskLevel = "normal";
  let status = "normal_trend";

  if (
    flags.has("possible_stunting_risk") ||
    (flags.has("low_growth_velocity") && flags.has("percentile_drop"))
  ) {
    riskLevel = "requires_attention";
    status = "requires_attention";
  } else if (flags.size > 0 || !withinExpectedWhoRange) {
    riskLevel = "below_expected_growth";
    status = "below_expected_growth";
  }

  const trendText = buildPredictionTrendText(predictedPoints, predictionMessage);
  const rangeText = withinExpectedWhoRange
    ? "Current measurements are within expected WHO-based range."
    : "Current measurements are below expected WHO-based range.";
  const warningText = anomalies.length
    ? "Warning signs were detected in recent growth dynamics."
    : "No clear warning signs were detected in recent growth dynamics.";

  const summary = `${trendText} ${rangeText} ${warningText}`;

  return {
    riskLevel,
    status,
    summary,
    latestPercentileBand,
    latestZScore,
    disclaimer:
      "For educational/demo purposes only. This is not a diagnosis; requires professional evaluation if concerns persist.",
  };
}

function buildChildGrowthInsights(child, measurements) {
  const sortedMeasurements = [...measurements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const timeline = sortedMeasurements
    .map((measurement) => ({
      ...measurement,
      ageMonths: getAgeInMonths(child.birthDate, measurement.date),
      height: Number(measurement.height),
      weight: Number(measurement.weight),
    }))
    .filter(
      (point) =>
        Number.isFinite(point.ageMonths) &&
        Number.isFinite(point.height) &&
        point.height > 0
    );

  const whoData = getWhoHeightData(child.gender);

  let predictionMessage = null;
  let predictedPoints = [];

  if (timeline.length < MIN_POINTS_FOR_PREDICTION) {
    predictionMessage = "Not enough data for prediction";
  } else {
    const regressionPoints = timeline.map((point) => ({
      x: point.ageMonths,
      y: point.height,
    }));

    const regression = fitLinearRegression(regressionPoints);

    const latest = timeline.at(-1);
    if (!regression || !latest) {
      predictionMessage = "Not enough data for prediction";
    } else {
      predictedPoints = predictNextMonths(
        regression,
        latest.ageMonths,
        latest.date,
        6
      );
    }
  }

  const anomalyResult = detectGrowthAnomalies({ timeline, whoData });

  const insight = generateGrowthInsight({
    anomalies: anomalyResult.anomalies,
    predictedPoints,
    predictionMessage,
    withinExpectedWhoRange: anomalyResult.withinExpectedWhoRange,
    latestPercentileBand: anomalyResult.latestPercentileBand,
    latestZScore: anomalyResult.latestZScore,
  });

  return {
    childId: child.id,
    generatedAt: new Date(),
    historicalMeasurements: sortedMeasurements,
    predictedPoints,
    predictionModel: "linear_regression",
    predictionMessage,
    anomalies: anomalyResult.anomalies,
    annualizedGrowthVelocity: anomalyResult.annualizedGrowthVelocity,
    withinExpectedWhoRange: anomalyResult.withinExpectedWhoRange,
    latestPercentileBand: anomalyResult.latestPercentileBand,
    latestZScore: anomalyResult.latestZScore,
    riskLevel: insight.riskLevel,
    status: insight.status,
    summary: insight.summary,
    disclaimer: insight.disclaimer,
  };
}

module.exports = {
  getAgeInMonths,
  fitLinearRegression,
  predictNextMonths,
  detectGrowthAnomalies,
  generateGrowthInsight,
  buildChildGrowthInsights,
};
