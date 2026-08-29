import type {
  ChildGrowthInsights,
  Measurement,
} from "@bala/shared";

type GrowthStoryProps = {
  measurements: Measurement[];
  insights: ChildGrowthInsights | null;
};

export default function GrowthStory({
  measurements,
  insights,
}: GrowthStoryProps) {
  const sortedMeasurements = [...measurements].sort(
    (a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-900">
          Growth Story
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          История роста ребёнка
        </p>
      </div>

      {/* Empty state */}
      {sortedMeasurements.length === 0 ? (
        <div className="text-sm text-slate-500">
          Пока недостаточно измерений для Growth Story.
        </div>
      ) : (
        <div className="space-y-2">
          {sortedMeasurements.map((measurement, index) => {
            const previousMeasurement =
              index > 0
                ? sortedMeasurements[index - 1]
                : null;

            const isLatest =
              index === sortedMeasurements.length - 1;

            // Изменение роста относительно предыдущего измерения
            const heightChange = previousMeasurement
              ? Number(measurement.height) -
                Number(previousMeasurement.height)
              : null;

            // Количество месяцев между измерениями
            const monthsBetween = previousMeasurement
              ? Math.max(
                  1,
                  Math.round(
                    (new Date(measurement.date).getTime() -
                      new Date(previousMeasurement.date).getTime()) /
                      (1000 * 60 * 60 * 24 * 30.44)
                  )
                )
              : null;

            // Темп роста в см/год
            const annualizedGrowth =
              heightChange !== null &&
              monthsBetween !== null &&
              monthsBetween > 0
                ? Number(
                    (
                      (heightChange / monthsBetween) *
                      12
                    ).toFixed(1)
                  )
                : null;

            // Статус промежутка роста
            const growthStatus =
              annualizedGrowth === null
                ? null
                : annualizedGrowth < 0
                  ? "Measurement anomaly"
                  : annualizedGrowth < 4
                    ? "Slow growth"
                    : "Normal growth";

            return (
              <div
                key={measurement.id}
                className="flex gap-3"
              >
                {/* Timeline */}
                <div className="flex w-4 shrink-0 flex-col items-center">
                  <div
                    className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                      isLatest
                        ? "bg-cyan-600 ring-2 ring-cyan-100"
                        : "bg-cyan-400"
                    }`}
                  />

                  {index < sortedMeasurements.length - 1 && (
                    <div className="min-h-12 w-px flex-1 bg-cyan-100" />
                  )}
                </div>

                {/* Measurement */}
                <div className="min-w-0 flex-1 pb-3">
                  {/* Date + latest */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xs text-slate-400">
                      {new Date(
                        measurement.date
                      ).toLocaleDateString()}
                    </div>

                    {isLatest && (
                      <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-700">
                        Latest
                      </span>
                    )}
                  </div>

                  {/* Height + weight */}
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <div className="text-lg font-bold text-slate-900">
                      {Number(measurement.height)} см
                    </div>

                    <div className="text-sm text-slate-500">
                      {Number(measurement.weight)} кг
                    </div>
                  </div>

                  {/* Growth information */}
                  {heightChange !== null && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          heightChange < 0
                            ? "bg-red-50 text-red-600"
                            : "bg-emerald-50 text-emerald-600"
                        }`}
                      >
                        {heightChange > 0 ? "+" : ""}
                        {heightChange.toFixed(1)} см
                      </span>

                      {monthsBetween !== null && (
                        <span className="text-xs text-slate-500">
                          за {monthsBetween} мес
                        </span>
                      )}

                      {annualizedGrowth !== null && (
                        <span
                          className={`text-xs font-semibold ${
                            annualizedGrowth < 0
                              ? "text-red-600"
                              : annualizedGrowth < 4
                                ? "text-amber-600"
                                : "text-emerald-600"
                          }`}
                        >
                          {annualizedGrowth} см/год
                        </span>
                      )}

                      {growthStatus && (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            growthStatus === "Measurement anomaly"
                              ? "bg-red-50 text-red-600"
                              : growthStatus === "Slow growth"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {growthStatus}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Suspicious height decrease */}
                  {heightChange !== null &&
                    heightChange < 0 && (
                      <div className="mt-2 text-xs font-semibold text-red-600">
                        ⚠ Height decreased — check measurement
                      </div>
                    )}

                  {/* Intelligence for latest measurement */}
                  {isLatest && insights && (
                    <div className="mt-3 rounded-xl border border-cyan-100 bg-cyan-50/70 p-3">
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-700">
                        Current Growth Intelligence
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        {/* Percentile */}
                        <div>
                          <div className="text-[11px] text-slate-500">
                            WHO percentile
                          </div>

                          <div className="mt-0.5 text-sm font-bold text-slate-900">
                            {insights.latestPercentileBand}
                          </div>
                        </div>

                        {/* Z-score */}
                        <div>
                          <div className="text-[11px] text-slate-500">
                            Z-score
                          </div>

                          <div className="mt-0.5 text-sm font-bold text-slate-900">
                            {insights.latestZScore !== null
                              ? insights.latestZScore.toFixed(2)
                              : "—"}
                          </div>
                        </div>

                        {/* Overall status */}
                        <div>
                          <div className="text-[11px] text-slate-500">
                            Status
                          </div>

                          <div
                            className={`mt-0.5 text-sm font-bold ${
                              insights.status ===
                              "requires_attention"
                                ? "text-red-600"
                                : insights.status ===
                                    "below_expected_growth"
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                            }`}
                          >
                            {insights.status ===
                            "requires_attention"
                              ? "Requires attention"
                              : insights.status ===
                                  "below_expected_growth"
                                ? "Below expected"
                                : "Normal trend"}
                          </div>
                        </div>
                      </div>

                      {/* Backend-generated summary */}
                      <div className="mt-2 border-t border-cyan-100 pt-2 text-xs leading-5 text-slate-600">
                        {insights.summary}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}