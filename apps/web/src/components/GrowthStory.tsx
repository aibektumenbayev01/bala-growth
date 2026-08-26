import type { Measurement } from "@bala/shared";

type GrowthStoryProps = {
  measurements: Measurement[];
};

export default function GrowthStory({ measurements }: GrowthStoryProps) {
  const sortedMeasurements = [...measurements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">
          Growth Story
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          История роста ребёнка
        </p>
      </div>

      {sortedMeasurements.length === 0 ? (
        <div className="text-slate-500">
          Пока недостаточно измерений для Growth Story.
        </div>
      ) : (
        <div className="space-y-6">
          {sortedMeasurements.map((measurement, index) => {
            const previousMeasurement =
              index > 0 ? sortedMeasurements[index - 1] : null;

            const heightChange = previousMeasurement
              ? Number(measurement.height) -
                Number(previousMeasurement.height)
              : null;

            return (
              <div
                key={measurement.id}
                className="flex gap-4"
              >
                <div className="flex flex-col items-center">
                  <div className="h-4 w-4 rounded-full bg-cyan-500" />

                  {index < sortedMeasurements.length - 1 && (
                    <div className="h-full w-0.5 bg-cyan-100" />
                  )}
                </div>

                <div className="pb-6">
                  <div className="text-sm text-slate-400">
                    {new Date(measurement.date).toLocaleDateString()}
                  </div>

                  <div className="mt-1 text-xl font-bold text-slate-900">
                    {Number(measurement.height)} см
                  </div>

                  <div className="text-sm text-slate-500">
                    {Number(measurement.weight)} кг
                  </div>

                  {heightChange !== null && (
                    <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-600">
                      +{heightChange.toFixed(1)} см
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