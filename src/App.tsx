import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Child, Measurement } from "@bala/shared";
import {
  Baby,
  Calendar,
  PlusCircle,
  ArrowLeft,
  Loader2,
  TrendingUp,
  Ruler,
  Weight,
  Trash2,
  User,
  Activity,
  AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import {
  getChildren,
  createChild,
  getMeasurements,
  createMeasurement,
  deleteMeasurement,
} from "./api";

import {
  prepareChildHeightMeasurements,
  prepareChartData,
  getAgeInMonths,
  getNearestWhoRow,
  getHeightPercentileBand,
  getHeightZScore,
  getHeightZScoreStatus,
} from "./lib/growth";

import { hfaBoys5to19 } from "./who/hfa-boys-5-19";
import { hfaGirls5to19 } from "./who/hfa-girls-5-19";

type Gender = "male" | "female";



function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}.${month}.${year}`;
}

function formatAge(ageMonths: number): string {
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  return `${years} г ${months} мес`;
}

function getGenderLabel(gender: Gender): string {
  return gender === "male" ? "Мальчик" : "Девочка";
}

function getWhoHeightData(gender: Gender) {
  return gender === "male" ? hfaBoys5to19 : hfaGirls5to19;
}

function getGrowthVelocityStatus(value: number | null): string {
  if (value === null) return "—";
  if (value < 4) return "Требует внимания";
  if (value < 5) return "Ниже ожидаемого";
  return "Нормальный темп";
}

function getAnalysisText(
  percentile: string,
  zScore: number | null,
  annualGrowth: number | null
): {
  title: string;
  description: string;
  recommendation: string;
  level: "normal" | "warning";
} {
  if (
    percentile === "<3rd" ||
    (zScore !== null && zScore < -2) ||
    (annualGrowth !== null && annualGrowth < 4)
  ) {
    return {
      title: "Требует внимания",
      description: "Отмечается замедление темпа роста или низкое положение на WHO-кривой.",
      recommendation:
        "Нужен контроль повторных измерений, желательно в одинаковых условиях. При сохранении отклонений — консультация педиатра / детского эндокринолога.",
      level: "warning",
    };
  }

  return {
    title: "Без выраженных отклонений",
    description: "Показатели роста выглядят стабильными относительно WHO-референсов.",
    recommendation:
      "Продолжайте регулярный мониторинг роста и веса каждые 3–6 месяцев.",
    level: "normal",
  };
}

type StatCardProps = {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle?: string;
};

function StatCard({ icon, title, value, subtitle }: StatCardProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
        {icon}
      </div>

      <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </div>

      <div className="mt-2 text-4xl font-bold text-slate-900">{value}</div>

      {subtitle ? (
        <div className="mt-3 text-sm leading-6 text-slate-500">{subtitle}</div>
      ) : null}
    </div>
  );
}

type ChartTooltipPayload = {
  value: number;
  name: string;
  dataKey: string;
  payload: {
    ageMonths: number;
    childHeight: number | null;
    p3: number;
    p15: number;
    p50: number;
    p85: number;
    p97: number;
  };
};

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ChartTooltipPayload[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
      <div className="mb-2 text-sm font-semibold text-slate-900">
        Возраст: {formatAge(point.ageMonths)}
      </div>
      <div className="space-y-1 text-sm text-slate-600">
        <div>Рост ребёнка: {point.childHeight ?? "—"} см</div>
        <div>P3: {point.p3} см</div>
        <div>P50: {point.p50} см</div>
        <div>P97: {point.p97} см</div>
      </div>
    </div>
  );
}

export default function App() {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingMeasurements, setLoadingMeasurements] = useState(false);
  const [submittingChild, setSubmittingChild] = useState(false);
  const [submittingMeasurement, setSubmittingMeasurement] = useState(false);
  const [deletingMeasurementId, setDeletingMeasurementId] = useState<string | null>(null);

  const [isCreateChildOpen, setIsCreateChildOpen] = useState(false);

  const [childName, setChildName] = useState("");
  const [childGender, setChildGender] = useState<Gender>("male");
  const [childBirthDate, setChildBirthDate] = useState("");

  const [measurementDate, setMeasurementDate] = useState("");
  const [measurementHeight, setMeasurementHeight] = useState("");
  const [measurementWeight, setMeasurementWeight] = useState("");

  useEffect(() => {
    void loadChildren();
  }, []);

  useEffect(() => {
    if (!selectedChildId) return;
    void loadMeasurements(selectedChildId);
  }, [selectedChildId]);

  async function loadChildren() {
    try {
      setLoadingChildren(true);
      const data = await getChildren();
      setChildren(data);

      if (data.length > 0 && !selectedChildId) {
        setSelectedChildId(data[0].id);
      }
    } catch (error) {
      console.error("Failed to load children:", error);
    } finally {
      setLoadingChildren(false);
    }
  }

  async function loadMeasurements(childId: string) {
    try {
      setLoadingMeasurements(true);
      const data = await getMeasurements(childId);
      const sorted = [...data].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      setMeasurements(sorted);
    } catch (error) {
      console.error("Failed to load measurements:", error);
    } finally {
      setLoadingMeasurements(false);
    }
  }

  async function handleCreateChild(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!childName.trim() || !childBirthDate) return;

    try {
      setSubmittingChild(true);

      const created = await createChild({
        name: childName.trim(),
        gender: childGender,
        birthDate: new Date(childBirthDate),
      });

      const updatedChildren = [...children, created];
      setChildren(updatedChildren);
      setSelectedChildId(created.id);
      setIsCreateChildOpen(false);

      setChildName("");
      setChildGender("male");
      setChildBirthDate("");
    } catch (error) {
      console.error("Failed to create child:", error);
    } finally {
      setSubmittingChild(false);
    }
  }

  async function handleCreateMeasurement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedChildId || !measurementDate || !measurementHeight || !measurementWeight) return;

    try {
      setSubmittingMeasurement(true);

      await createMeasurement(selectedChildId, {
        date: new Date(measurementDate),
        height: Number(measurementHeight),
        weight: Number(measurementWeight),
      });

      setMeasurementDate("");
      setMeasurementHeight("");
      setMeasurementWeight("");

      await loadMeasurements(selectedChildId);
    } catch (error) {
      console.error("Failed to create measurement:", error);
    } finally {
      setSubmittingMeasurement(false);
    }
  }

  async function handleDeleteMeasurement(id: string) {
    if (!selectedChildId) return;

    try {
      setDeletingMeasurementId(id);
      await deleteMeasurement(id);
      await loadMeasurements(selectedChildId);
    } catch (error) {
      console.error("Failed to delete measurement:", error);
    } finally {
      setDeletingMeasurementId(null);
    }
  }

  const selectedChild =
    children.find((child) => child.id === selectedChildId) ?? null;

  const selectedChildAgeMonths = useMemo(() => {
    if (!selectedChild) return 0;
    return getAgeInMonths(selectedChild.birthDate, new Date());
  }, [selectedChild]);

  const childMeasurements = useMemo(() => {
    if (!selectedChild) return [];

    return prepareChildHeightMeasurements(
      selectedChild.birthDate,
      measurements.map((m) => ({
        date: m.date,
        height: safeNumber(m.height),
      }))
    );
  }, [selectedChild, measurements]);

  const whoHeightData = useMemo(() => {
    if (!selectedChild) return [];
    return getWhoHeightData(selectedChild.gender as Gender);
  }, [selectedChild]);

  const chartData = useMemo(() => {
    return prepareChartData(whoHeightData, childMeasurements);
  }, [whoHeightData, childMeasurements]);

  const derived = useMemo(() => {
    if (!selectedChild || measurements.length === 0) return null;

    const sorted = [...measurements].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const last = sorted.at(-1);
    const prev = sorted.length >= 2 ? sorted.at(-2) : null;

    if (!last) return null;

    const ageMonths = getAgeInMonths(selectedChild.birthDate, last.date);
    const whoRow = getNearestWhoRow(whoHeightData, ageMonths);

    const currentHeight = safeNumber(last.height);
    const currentWeight = safeNumber(last.weight);

    const percentile = getHeightPercentileBand(currentHeight, whoRow);
    const zScore = getHeightZScore(currentHeight, whoRow);
    const zScoreStatus = getHeightZScoreStatus(zScore);

    let annualGrowth: number | null = null;
    if (prev) {
      const monthsDiff = getAgeInMonths(prev.date, last.date);
      const heightDiff = currentHeight - safeNumber(prev.height);

      if (monthsDiff > 0) {
        annualGrowth = Number(((heightDiff / monthsDiff) * 12).toFixed(1));
      }
    }

    const annualGrowthStatus = getGrowthVelocityStatus(annualGrowth);
    const analysis = getAnalysisText(percentile, zScore, annualGrowth);

    return {
      ageMonths,
      whoRow,
      currentHeight,
      currentWeight,
      percentile,
      zScore,
      zScoreStatus,
      annualGrowth,
      annualGrowthStatus,
      last,
      prev,
      analysis,
    };
  }, [selectedChild, measurements, whoHeightData]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500 text-white shadow-sm">
              <Activity size={22} />
            </div>
            <div>
              <div className="text-2xl font-bold">GrowthTrack KZ</div>
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                Pediatric Health Platform
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateChildOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-600"
          >
            <PlusCircle size={18} />
            Добавить ребёнка
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Dashboard
            </div>

            <div className="space-y-3">
              {loadingChildren ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 size={18} className="animate-spin" />
                  Загрузка...
                </div>
              ) : children.length === 0 ? (
                <div className="text-sm text-slate-500">Пока нет профилей детей.</div>
              ) : (
                children.map((child) => {
                  const ageMonths = getAgeInMonths(child.birthDate, new Date());

                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => setSelectedChildId(child.id)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                        selectedChildId === child.id
                          ? "border-cyan-200 bg-cyan-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600">
                          <Baby size={18} />
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-lg font-semibold text-slate-900">
                            {child.name}
                          </div>
                          <div className="text-sm text-slate-500">
                            {getGenderLabel(child.gender as Gender)}
                          </div>
                          <div className="mt-1 text-sm text-slate-500">
                            {formatAge(ageMonths)}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-100 bg-cyan-50 p-5 shadow-sm">
            <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-cyan-700">
              Reminder
            </div>
            <div className="text-sm leading-6 text-slate-600">
              Следующее измерение желательно внести через 2–4 недели, если есть
              отклонения по росту или темпу роста.
            </div>
          </div>
        </aside>

        <section className="space-y-8">
          {!selectedChild ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="text-3xl font-bold text-slate-900">
                Мониторинг роста детей
              </div>
              <div className="mt-3 max-w-2xl text-lg leading-8 text-slate-500">
                Добавляй профили детей, сохраняй измерения роста и веса, смотри
                историю и графики WHO в одном месте.
              </div>

              {isCreateChildOpen ? (
                <form onSubmit={handleCreateChild} className="mt-8 grid gap-4 md:grid-cols-3">
                  <input
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    placeholder="Имя ребёнка"
                    className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-cyan-400"
                  />

                  <select
                    value={childGender}
                    onChange={(e) => setChildGender(e.target.value as Gender)}
                    className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-cyan-400"
                  >
                    <option value="male">Мальчик</option>
                    <option value="female">Девочка</option>
                  </select>

                  <input
                    type="date"
                    value={childBirthDate}
                    onChange={(e) => setChildBirthDate(e.target.value)}
                    className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-cyan-400"
                  />

                  <div className="md:col-span-3 flex gap-3">
                    <button
                      type="submit"
                      disabled={submittingChild}
                      className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-white transition hover:bg-cyan-600 disabled:opacity-60"
                    >
                      {submittingChild ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <PlusCircle size={18} />
                      )}
                      Сохранить
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsCreateChildOpen(false)}
                      className="rounded-2xl border border-slate-200 px-5 py-3 font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="mt-10 text-lg font-semibold text-slate-900">Профили детей</div>

              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {children.map((child) => {
                  const ageMonths = getAgeInMonths(child.birthDate, new Date());

                  return (
                    <div
                      key={child.id}
                      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-600">
                          <Baby size={24} />
                        </div>

                        <div>
                          <div className="text-2xl font-bold text-slate-900">{child.name}</div>
                          <div className="text-sm uppercase tracking-wide text-slate-400">
                            {getGenderLabel(child.gender as Gender)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 space-y-2 text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                          <Calendar size={16} />
                          {formatDate(child.birthDate)}
                        </div>
                        <div>{formatAge(ageMonths)}</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedChildId(child.id)}
                        className="mt-6 w-full rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Открыть профиль
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-5">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-cyan-100 bg-cyan-50 text-cyan-600">
                    <User size={36} />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-4xl font-bold text-slate-900">{selectedChild.name}</h1>

                      {derived && derived.analysis.level === "warning" ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-600">
                          <AlertTriangle size={16} />
                          Требует внимания
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-5 text-slate-500">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} />
                        {formatAge(selectedChildAgeMonths)}
                      </div>
                      <div>{getGenderLabel(selectedChild.gender as Gender)}</div>
                      <div>Дата рождения: {formatDate(selectedChild.birthDate)}</div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedChildId(null)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  <ArrowLeft size={18} />
                  К списку
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                <StatCard
                  icon={<Ruler size={22} />}
                  title="Current Height"
                  value={derived ? `${derived.currentHeight} см` : "—"}
                  subtitle={
                    derived?.annualGrowth !== null
                      ? `Темп: ${derived?.annualGrowth} см/год`
                      : "Недостаточно данных для темпа роста"
                  }
                />

                <StatCard
                  icon={<Weight size={22} />}
                  title="Current Weight"
                  value={derived ? `${derived.currentWeight} кг` : "—"}
                  subtitle="Последнее зарегистрированное измерение веса"
                />

                <StatCard
                  icon={<TrendingUp size={22} />}
                  title="Height Percentile"
                  value={derived?.percentile ?? "—"}
                  subtitle="WHO height-for-age"
                />

                <StatCard
                  icon={<Activity size={22} />}
                  title="Height Z-Score"
                  value={derived?.zScore !== null && derived?.zScore !== undefined ? String(derived.zScore) : "—"}
                  subtitle={derived?.zScoreStatus ?? "—"}
                />

                <StatCard
                  icon={<Baby size={22} />}
                  title="Measurements"
                  value={String(measurements.length)}
                  subtitle="Всего записей в истории"
                />

                <StatCard
                  icon={<Calendar size={22} />}
                  title="Last Measurement"
                  value={derived ? formatDate(derived.last.date) : "—"}
                  subtitle={
                    derived?.annualGrowthStatus
                      ? `Темп роста: ${derived.annualGrowthStatus}`
                      : "—"
                  }
                />
              </div>

              {derived ? (
                <div
                  className={`rounded-3xl border p-6 shadow-sm ${
                    derived.analysis.level === "warning"
                      ? "border-red-200 bg-red-50"
                      : "border-emerald-200 bg-emerald-50"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-6">
                    <div className="max-w-3xl">
                      <div className="flex items-center gap-3">
                        <AlertTriangle
                          size={20}
                          className={
                            derived.analysis.level === "warning"
                              ? "text-red-500"
                              : "text-emerald-500"
                          }
                        />
                        <div className="text-3xl font-bold text-slate-900">
                          Результат анализа
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-semibold ${
                            derived.analysis.level === "warning"
                              ? "border border-red-200 bg-red-100 text-red-600"
                              : "border border-emerald-200 bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {derived.analysis.title}
                        </span>
                      </div>

                      <div className="mt-5 text-2xl font-semibold text-slate-900">
                        {derived.analysis.description}
                      </div>

                      <div className="mt-4 text-lg leading-8 text-slate-600">
                        Z-score: {derived.zScore ?? "—"}, перцентиль: {derived.percentile},
                        темп роста: {derived.annualGrowth ?? "—"} см/год.
                      </div>

                      <div className="mt-6 rounded-2xl bg-white/70 p-5 text-base leading-7 text-slate-700">
                        <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                          Рекомендация
                        </div>
                        {derived.analysis.recommendation}
                      </div>
                    </div>

                    <div className="min-w-[280px] rounded-2xl bg-white/70 p-5">
                      <div className="space-y-3 text-base text-slate-600">
                        <div className="flex items-center justify-between gap-4">
                          <span>Перцентиль роста</span>
                          <span className="font-bold text-slate-900">{derived.percentile}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Z-score</span>
                          <span className="font-bold text-slate-900">
                            {derived.zScore ?? "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Темп роста</span>
                          <span className="font-bold text-slate-900">
                            {derived.annualGrowth ?? "—"} см/год
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Следующий контроль</span>
                          <span className="font-bold text-slate-900">
                            {derived.analysis.level === "warning"
                              ? "Через 1–2 месяца"
                              : "Через 3–6 месяцев"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-slate-900">
                      WHO Height-for-age Chart
                    </div>
                    <div className="mt-2 text-lg text-slate-500">
                      WHO reference percentiles + рост ребёнка
                    </div>
                  </div>
                </div>

                <div className="mt-6 h-[420px] w-full rounded-3xl border border-slate-100 bg-slate-50 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={true} />
                      <XAxis
                        dataKey="ageMonths"
                        tickFormatter={(value) => {
                          const years = Math.floor(value / 12);
                          const months = value % 12;
                          return `${years}г ${months}м`;
                        }}
                      />
                      <YAxis />
                      <Tooltip content={<ChartTooltip />} />

                      <Line type="monotone" dataKey="p3" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="p15" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="p50" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="p85" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="p97" strokeWidth={2} dot={false} />

                      <Line
                        type="monotone"
                        dataKey="childHeight"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-3xl font-bold text-slate-900">
                        Добавить измерение
                      </div>
                      <div className="mt-2 text-lg leading-7 text-slate-500">
                        Дата, рост и вес сохраняются в базу.
                      </div>
                    </div>

                    {derived?.analysis.level === "warning" ? (
                      <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-600">
                        Требует внимания
                      </span>
                    ) : null}
                  </div>

                  <form onSubmit={handleCreateMeasurement} className="mt-6 space-y-4">
                    <input
                      type="date"
                      value={measurementDate}
                      onChange={(e) => setMeasurementDate(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-cyan-400"
                    />

                    <input
                      type="number"
                      step="0.1"
                      value={measurementHeight}
                      onChange={(e) => setMeasurementHeight(e.target.value)}
                      placeholder="Рост (см)"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-cyan-400"
                    />

                    <input
                      type="number"
                      step="0.1"
                      value={measurementWeight}
                      onChange={(e) => setMeasurementWeight(e.target.value)}
                      placeholder="Вес (кг)"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-cyan-400"
                    />

                    <button
                      type="submit"
                      disabled={submittingMeasurement}
                      className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-white transition hover:bg-cyan-600 disabled:opacity-60"
                    >
                      {submittingMeasurement ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <PlusCircle size={18} />
                      )}
                      Сохранить
                    </button>
                  </form>

                  {derived ? (
                    <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-5">
                      <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                        Рекомендация после анализа
                      </div>
                      <div className="text-xl font-semibold text-slate-900">
                        {derived.analysis.title}
                      </div>
                      <div className="mt-3 text-base leading-7 text-slate-600">
                        {derived.analysis.recommendation}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="text-3xl font-bold text-slate-900">
                      История измерений
                    </div>
                    <div className="text-sm font-semibold text-slate-400">
                      {measurements.length} записей
                    </div>
                  </div>

                  {loadingMeasurements ? (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Loader2 size={18} className="animate-spin" />
                      Загрузка измерений...
                    </div>
                  ) : measurements.length === 0 ? (
                    <div className="text-slate-500">Пока нет измерений.</div>
                  ) : (
                    <div className="space-y-4">
                      {[...measurements]
                        .sort(
                          (a, b) =>
                            new Date(b.date).getTime() - new Date(a.date).getTime()
                        )
                        .map((measurement) => (
                          <div
                            key={measurement.id}
                            className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-4"
                          >
                            <div className="min-w-0">
                              <div className="text-lg font-medium text-slate-500">
                                {formatDate(measurement.date)}
                              </div>
                            </div>

                            <div className="text-xl font-bold text-slate-900">
                              {safeNumber(measurement.height)} см
                            </div>

                            <div className="text-xl font-bold text-slate-900">
                              {safeNumber(measurement.weight)} кг
                            </div>

                            <button
                              type="button"
                              onClick={() => void handleDeleteMeasurement(measurement.id)}
                              disabled={deletingMeasurementId === measurement.id}
                              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-200 text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingMeasurementId === measurement.id ? (
                                <Loader2 size={18} className="animate-spin" />
                              ) : (
                                <Trash2 size={18} />
                              )}
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}