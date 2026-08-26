import { useMemo } from "react";
import type { Measurement } from "@bala/shared";

import {
  getAgeInMonths,
  getNearestWhoRow,
  getHeightPercentileBand,
  getHeightZScore,
} from "../lib/growth";

import { hfaBoys5to19 } from "../who/hfa-boys-5-19";
import { hfaGirls5to19 } from "../who/hfa-girls-5-19";

type GrowthSimulatorProps = {
  measurements: Measurement[];
  birthDate: Date;
  gender: "male" | "female";

  growthRate: number;
  monthsAhead: number;

  onGrowthRateChange: (value: number) => void;
  onMonthsAheadChange: (value: number) => void;
};

function addMonths(dateValue: Date | string, months: number) {
  const date = new Date(dateValue);

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      date.getUTCDate()
    )
  );
}

function formatZScore(value: number | null) {
  if (value === null) return "—";

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

export default function GrowthSimulator({
  measurements,
  birthDate,
  gender,
  growthRate,
  monthsAhead,
  onGrowthRateChange,
  onMonthsAheadChange,
}: GrowthSimulatorProps) {


  const latestMeasurement = useMemo(() => {
    if (measurements.length === 0) {
      return null;
    }

    return (
      [...measurements]
        .sort(
          (a, b) =>
            new Date(a.date).getTime() -
            new Date(b.date).getTime()
        )
        .at(-1) ?? null
    );
  }, [measurements]);

  const simulation = useMemo(() => {
    if (!latestMeasurement) {
      return null;
    }

    const currentHeight = Number(
      latestMeasurement.height
    );

    const heightIncrease =
      growthRate * (monthsAhead / 12);

    const projectedHeight = Number(
      (currentHeight + heightIncrease).toFixed(1)
    );

    const futureDate = addMonths(
      latestMeasurement.date,
      monthsAhead
    );

    const futureAgeMonths = getAgeInMonths(
      birthDate,
      futureDate
    );

    const whoData =
      gender === "female"
        ? hfaGirls5to19
        : hfaBoys5to19;

    const whoRow = getNearestWhoRow(
      whoData,
      futureAgeMonths
    );

    const projectedPercentile =
      getHeightPercentileBand(
        projectedHeight,
        whoRow
      );

    const projectedZScore = getHeightZScore(
      projectedHeight,
      whoRow
    );

    return {
      currentHeight,
      projectedHeight,
      heightIncrease,
      futureDate,
      futureAgeMonths,
      projectedPercentile,
      projectedZScore,
    };
  }, [
    latestMeasurement,
    growthRate,
    monthsAhead,
    birthDate,
    gender,
  ]);

  if (!latestMeasurement || !simulation) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">
          Growth Simulator
        </h2>

        <p className="mt-2 text-slate-500">
          Добавь хотя бы одно измерение для симуляции.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Growth Simulator
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          What if рост продолжится с выбранной
          скоростью?
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Controls */}
        <div>
          <label className="text-sm font-semibold text-slate-600">
            Темп роста: {growthRate.toFixed(1)} см/год
          </label>

          <input
            type="range"
            min="1"
            max="10"
            step="0.1"
            value={growthRate}
            onChange={(event) =>
            onGrowthRateChange(Number(event.target.value))
            }
            
            className="mt-3 w-full"
          />

          <div className="mt-2 flex justify-between text-xs text-slate-400">
            <span>1 см/год</span>
            <span>10 см/год</span>
          </div>

          <div className="mt-6">
            <label className="text-sm font-semibold text-slate-600">
              Период прогноза
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              {[6, 12, 24].map((months) => (
                <button
                  key={months}
                  type="button"
                  onClick={() => onMonthsAheadChange(months)}

                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    monthsAhead === months
                      ? "bg-cyan-500 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {months} мес
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Result */}
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-5">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">
            Projected result
          </div>

          <div className="mt-4">
            <div className="text-sm text-slate-500">
              Сейчас
            </div>

            <div className="text-2xl font-bold text-slate-900">
              {simulation.currentHeight} см
            </div>
          </div>

          <div className="my-4 text-2xl text-cyan-500">
            ↓
          </div>

          <div>
            <div className="text-sm text-slate-500">
              Через {monthsAhead} мес
            </div>

            <div className="text-3xl font-bold text-cyan-700">
              {simulation.projectedHeight} см
            </div>

            <div className="mt-1 text-sm font-semibold text-emerald-600">
              +
              {simulation.heightIncrease.toFixed(1)} см
            </div>
          </div>

          {/* WHO projection */}
          <div className="mt-6 grid gap-3 border-t border-cyan-100 pt-4 sm:grid-cols-2">
            <div>
              <div className="text-xs text-slate-500">
                Projected WHO percentile
              </div>

              <div className="mt-1 text-lg font-bold text-slate-900">
                {simulation.projectedPercentile}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">
                Projected Z-score
              </div>

              <div className="mt-1 text-lg font-bold text-slate-900">
                {formatZScore(
                  simulation.projectedZScore
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 text-sm leading-6 text-slate-600">
            При темпе {growthRate.toFixed(1)} см/год
            через {monthsAhead} месяцев прогнозируемый
            рост составит{" "}
            {simulation.projectedHeight} см.
          </div>

          <div className="mt-3 text-xs leading-5 text-slate-500">
            Simulation is exploratory and is not a
            medical prediction.
          </div>
        </div>
      </div>
    </div>
  );
}