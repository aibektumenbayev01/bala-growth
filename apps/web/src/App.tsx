import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Child, ChildGrowthInsights, GrowthAnomalyFlag, Measurement } from "@bala/shared";
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
  getChildInsights,
  createMeasurement,
  deleteMeasurement,
  deleteChild,
  login,
  register,
  logout,
  getToken,
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
import GrowthStory from "./components/GrowthStory";
import GrowthSimulator from "./components/GrowthSimulator";
import GrowthReportButton from "./components/GrowthReportButton";

type Gender = "male" | "female";

function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseDateInputAsUtc(dateInput: string): Date {
  return new Date(`${dateInput}T00:00:00.000Z`);
}

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();

  return `${day}.${month}.${year}`;
}

function formatAge(ageMonths: number): string {
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  return `${years} г ${months} мес`;
}

function formatZScore(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
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

function getInsightStatusLabel(status: ChildGrowthInsights["status"]): string {
  if (status === "requires_attention") return "Requires attention";
  if (status === "below_expected_growth") return "Below expected growth";
  return "Normal trend";
}

function getInsightRiskBadgeClass(riskLevel: ChildGrowthInsights["riskLevel"]): string {
  if (riskLevel === "requires_attention") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (riskLevel === "below_expected_growth") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function getAnomalyFlagLabel(flag: GrowthAnomalyFlag): string {
  if (flag === "low_growth_velocity") return "Low growth velocity";
  if (flag === "percentile_drop") return "Percentile band drop";
  return "Possible stunting risk";
}

type StatCardProps = {
  icon: ReactNode;
  title: string;
  value: string;
  subtitle?: string;
};

function StatCard({ icon, title, value, subtitle }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
        {icon}
      </div>

      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </div>

      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>

      {subtitle ? (
        <div className="mt-2 text-sm leading-5 text-slate-500">{subtitle}</div>
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
    predictedHeight: number | null;
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
        <div>Прогноз роста: {point.predictedHeight ?? "—"} см</div>
        <div>P3: {point.p3} см</div>
        <div>P50: {point.p50} см</div>
        <div>P97: {point.p97} см</div>
      </div>
    </div>
  );
}

export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(getToken())
  );

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [insights, setInsights] = useState<ChildGrowthInsights | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingMeasurements, setLoadingMeasurements] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [submittingChild, setSubmittingChild] = useState(false);
  const [submittingMeasurement, setSubmittingMeasurement] = useState(false);
  const [deletingMeasurementId, setDeletingMeasurementId] = useState<string | null>(null);

  const [isCreateChildOpen, setIsCreateChildOpen] = useState(false);

  const [childName, setChildName] = useState("");
  const [childGender, setChildGender] = useState<Gender>("male");
  const [newBirthDate, setNewBirthDate] = useState("");
  const [childFormError, setChildFormError] = useState<string | null>(null);

  const [measurementDate, setMeasurementDate] = useState(getTodayIsoDate());
  const [measurementHeight, setMeasurementHeight] = useState("");
  const [measurementWeight, setMeasurementWeight] = useState("");

  const [simulationGrowthRate, setSimulationGrowthRate] = useState(5);
  const [simulationMonthsAhead, setSimulationMonthsAhead] = useState(12);

  const loadChildren = useCallback(async () => {
    try {
      setLoadingChildren(true);
      const data = await getChildren();
      setChildren(data);
      setSelectedChildId((prev) => prev ?? data[0]?.id ?? null);
    } catch (error) {
      console.error("Failed to load children:", error);
    } finally {
      setLoadingChildren(false);
    }
  }, []);

  const loadMeasurements = useCallback(async (childId: string) => {
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
  }, []);

  const loadInsights = useCallback(async (childId: string) => {
    try {
      setLoadingInsights(true);
      const data = await getChildInsights(childId);
      setInsights(data);
    } catch (error) {
      console.error("Failed to load child insights:", error);
      setInsights(null);
    } finally {
      setLoadingInsights(false);
    }
  }, []);

useEffect(() => {
  if (isAuthenticated) {
    void loadChildren();
  } else {
    setLoadingChildren(false);
  }
}, [isAuthenticated, loadChildren]);

  useEffect(() => {
    if (!selectedChildId) {
      setMeasurements([]);
      setInsights(null);
      return;
    }

    void loadMeasurements(selectedChildId);
    void loadInsights(selectedChildId);
  }, [selectedChildId, loadMeasurements, loadInsights]);

  function handleLogout() {
  logout();

  setIsAuthenticated(false);
  setChildren([]);
  setSelectedChildId(null);
  setMeasurements([]);
  setInsights(null);
}

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (!email || !password) {
    setAuthError("Введите email и пароль.");
    return;
  }

  try {
    setAuthLoading(true);
    setAuthError(null);

    if (authMode === "login") {
      await login(email, password);
    } else {
      await register(email, password);
    }

    setIsAuthenticated(true);
    setEmail("");
    setPassword("");
  } catch (error) {
    if (error instanceof Error) {
      setAuthError(error.message);
    } else {
      setAuthError("Произошла ошибка.");
    }
  } finally {
    setAuthLoading(false);
  }
}

  async function handleCreateChild(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = childName.trim();

    if (!trimmedName || !newBirthDate) {
      setChildFormError("Заполни имя ребёнка и дату рождения.");
      return;
    }

    const birthDate = parseDateInputAsUtc(newBirthDate);

    if (Number.isNaN(birthDate.getTime())) {
      setChildFormError("Некорректная дата рождения.");
      return;
    }

    if (birthDate.getTime() > parseDateInputAsUtc(getTodayIsoDate()).getTime()) {
      setChildFormError("Дата рождения не может быть в будущем.");
      return;
    }

    try {
      setSubmittingChild(true);
      setChildFormError(null);

      const created = await createChild({
        name: trimmedName,
        gender: childGender,
        birthDate,
      });

      setChildren((prev) => [...prev, created]);
      setSelectedChildId(created.id);
      setIsCreateChildOpen(false);

      setChildName("");
      setChildGender("male");
      setNewBirthDate("");
    } catch (error) {
      console.error("Failed to create child:", error);
      setChildFormError("Не удалось сохранить профиль. Попробуй ещё раз.");
    } finally {
      setSubmittingChild(false);
    }
  }

  async function handleCreateMeasurement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedChildId || !measurementDate || !measurementHeight || !measurementWeight) {
      return;
    }

    const parsedDate = parseDateInputAsUtc(measurementDate);
    const parsedHeight = Number(measurementHeight);
    const parsedWeight = Number(measurementWeight);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      !Number.isFinite(parsedHeight) ||
      !Number.isFinite(parsedWeight) ||
      parsedHeight <= 0 ||
      parsedWeight <= 0
    ) {
      return;
    }

    try {
      setSubmittingMeasurement(true);

      await createMeasurement(selectedChildId, {
        date: parsedDate,
        height: parsedHeight,
        weight: parsedWeight,
      });

      setMeasurementDate(getTodayIsoDate());
      setMeasurementHeight("");
      setMeasurementWeight("");

      await loadMeasurements(selectedChildId);
      await loadInsights(selectedChildId);
    } catch (error) {
      console.error("Failed to create measurement:", error);
    } finally {
      setSubmittingMeasurement(false);
    }
  }

  async function handleDeleteChild(childId: string, childName: string) {
    const confirmed = window.confirm(
      `Удалить профиль "${childName}"? Это также удалит все измерения этого ребёнка.`
    );

    if (!confirmed) return;

    try {
      await deleteChild(childId);

      const updatedChildren = children.filter((child) => child.id !== childId);
      setChildren(updatedChildren);

      if (selectedChildId === childId) {
        setMeasurements([]);
        setInsights(null);
        setSelectedChildId(updatedChildren[0]?.id ?? null);
      }
    } catch (error) {
      console.error(error);
      alert("Не удалось удалить профиль ребёнка");
    }
  }

  async function handleDeleteMeasurement(id: string) {
    if (!selectedChildId) return;

    try {
      setDeletingMeasurementId(id);
      await deleteMeasurement(id);
      await loadMeasurements(selectedChildId);
      await loadInsights(selectedChildId);
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

    const selectedMeasurements = measurements.filter(
      (m) => m.childId === selectedChild.id
    );

    return prepareChildHeightMeasurements(
      selectedChild.birthDate,
      selectedMeasurements.map((m) => ({
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
    const predictedPoints =
      insights?.predictedPoints.map((point) => ({
        ageMonths: point.ageMonths,
        predictedHeight: safeNumber(point.predictedHeight),
      })) ?? [];

    return prepareChartData(whoHeightData, childMeasurements, predictedPoints);
  }, [whoHeightData, childMeasurements, insights]);

 const derived = useMemo(() => {
  if (!selectedChild || measurements.length === 0) return null;

  const sorted = [...measurements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const last = sorted.at(-1);
  const prev = sorted.length >= 2 ? sorted.at(-2) : null;

  if (!last) return null;

  const ageMonths = getAgeInMonths(
    selectedChild.birthDate,
    last.date
  );

  const whoRow = getNearestWhoRow(
    whoHeightData,
    ageMonths
  );

  const currentHeight = safeNumber(last.height);
  const currentWeight = safeNumber(last.weight);

  const percentile = getHeightPercentileBand(
    currentHeight,
    whoRow
  );

  const zScore = getHeightZScore(
    currentHeight,
    whoRow
  );

  const zScoreStatus = getHeightZScoreStatus(zScore);

  let annualGrowth: number | null = null;

  if (prev) {
    const monthsDiff = getAgeInMonths(
      prev.date,
      last.date
    );

    const heightDiff =
      currentHeight - safeNumber(prev.height);

    if (monthsDiff > 0) {
      annualGrowth = Number(
        ((heightDiff / monthsDiff) * 12).toFixed(1)
      );
    }
  }

  const annualGrowthStatus =
    getGrowthVelocityStatus(annualGrowth);

  const analysis = getAnalysisText(
    percentile,
    zScore,
    annualGrowth
  );

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
}, [
  selectedChild,
  measurements,
  whoHeightData,
]);

const chartDataWithSimulation = useMemo(() => {
  if (!derived) {
    return chartData;
  }

  const currentAgeMonths = derived.ageMonths;
  const currentHeight = derived.currentHeight;

  const futureAgeMonths =
    currentAgeMonths + simulationMonthsAhead;

  const futureHeight =
    currentHeight +
    simulationGrowthRate *
      (simulationMonthsAhead / 12);

  return chartData.map((point) => {
    if (point.ageMonths === currentAgeMonths) {
      return {
        ...point,
        simulatedHeight: currentHeight,
      };
    }

    if (point.ageMonths === futureAgeMonths) {
      return {
        ...point,
        simulatedHeight: Number(
          futureHeight.toFixed(1)
        ),
      };
    }

    return {
      ...point,
      simulatedHeight: null,
    };
  });
}, [
  chartData,
  derived,
  simulationGrowthRate,
  simulationMonthsAhead,
]);

  const hasInsightWarnings = (insights?.anomalies.length ?? 0) > 0;

  if (!isAuthenticated) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500 text-white">
            <Activity size={26} />
          </div>

          <h1 className="text-3xl font-bold text-slate-900">
            GrowthTrack KZ
          </h1>

          <p className="mt-2 text-slate-500">
            Pediatric Health Platform
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-600">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-600">
              Пароль
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-cyan-400"
            />
          </div>

          {authError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {authError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={authLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-white transition hover:bg-cyan-600 disabled:opacity-60"
          >
            {authLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : null}

            {authMode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setAuthMode(authMode === "login" ? "register" : "login");
            setAuthError(null);
          }}
          className="mt-5 w-full text-sm font-semibold text-cyan-600"
        >
          {authMode === "login"
            ? "Нет аккаунта? Зарегистрироваться"
            : "Уже есть аккаунт? Войти"}
        </button>
      </div>
    </div>
  );
}

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

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              Выйти
            </button>

            <button
              type="button"
              onClick={() => {
                setChildFormError(null);
                setIsCreateChildOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-600"
            >
              <PlusCircle size={18} />
              Добавить ребёнка
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1280px] grid-cols-1 gap-6 px-5 py-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                        selectedChildId === child.id
                          ? "border-cyan-200 bg-cyan-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600">
                          <Baby size={18} />
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold text-slate-900">
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

              <div className="mt-8 rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm leading-6 text-slate-600">
                Для добавления нового профиля нажми кнопку{" "}
                <span className="font-semibold text-cyan-700">«Добавить ребёнка»</span> в
                правом верхнем углу.
              </div>

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
                          <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                            {child.gender === "male" ? "Мальчик" : "Девочка"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 text-slate-500">
                        <div>{formatDate(child.birthDate)}</div>
                        <div>{formatAge(ageMonths)}</div>
                      </div>

                      <div className="mt-4 flex gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedChildId(child.id)}
                          className="flex-1 rounded-2xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Открыть профиль
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleDeleteChild(child.id, child.name)}
                          className="inline-flex items-center justify-center rounded-2xl border border-red-200 px-4 py-3 text-red-600 transition hover:bg-red-50"
                          title="Удалить профиль"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-5">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-cyan-100 bg-cyan-50 text-cyan-600">
                    <User size={28} />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-3xl font-bold text-slate-900">{selectedChild.name}</h1>

                      {hasInsightWarnings ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-600">
                          <AlertTriangle size={16} />
                          Requires attention
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-4 text-slate-500">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} />
                        {formatAge(selectedChildAgeMonths)}
                      </div>
                      <div>{getGenderLabel(selectedChild.gender as Gender)}</div>
                      <div>Дата рождения: {formatDate(selectedChild.birthDate)}</div>
                    </div>
                  </div>
                </div>

            <div className="flex items-center gap-3">
          <GrowthReportButton
            child={selectedChild}
            measurements={measurements}
            insights={insights}
          />

          <button
            type="button"
            onClick={() => setSelectedChildId(null)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft size={18} />
            К списку
          </button>
          </div>
        </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                  value={formatZScore(derived?.zScore ?? null)}
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
                  className={`rounded-2xl border p-5 shadow-sm ${
                    derived.analysis.level === "warning"
                      ? "border-red-200 bg-red-50"
                      : "border-emerald-200 bg-emerald-50"
                  }`}
                >
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
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
                        <div className="text-2xl font-bold text-slate-900">
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

                      <div className="mt-4 text-xl font-semibold text-slate-900">
                        {derived.analysis.description}
                      </div>

                      <div className="mt-3 text-lg leading-7 text-slate-600">
                        Z-score: {formatZScore(derived.zScore)}, перцентиль: {derived.percentile},
                        темп роста: {derived.annualGrowth ?? "—"} см/год.
                      </div>

                      <div className="mt-4 rounded-xl bg-white/70 p-4 text-sm leading-6 text-slate-700">
                        <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                          Рекомендация
                        </div>
                        {derived.analysis.recommendation}
                      </div>
                    </div>

                    <div className="rounded-xl bg-white/70 p-4">
                      <div className="space-y-3 text-base text-slate-600">
                        <div className="flex items-center justify-between gap-4">
                          <span>Перцентиль роста</span>
                          <span className="font-bold text-slate-900">{derived.percentile}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Z-score</span>
                          <span className="font-bold text-slate-900">
                            {formatZScore(derived.zScore)}
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

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-2xl font-bold text-slate-900">Growth AI Insights</div>
                    <div className="mt-1 text-sm text-slate-500">
                      Deterministic growth analytics + 6-month height prediction
                    </div>
                  </div>

                  {loadingInsights ? (
                    <Loader2 size={18} className="animate-spin text-slate-400" />
                  ) : null}
                </div>

                {loadingInsights ? (
                  <div className="text-sm text-slate-500">Loading insights...</div>
                ) : !insights ? (
                  <div className="text-sm text-slate-500">
                    Insights are not available yet for this profile.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full border px-3 py-1 text-sm font-semibold ${getInsightRiskBadgeClass(
                          insights.riskLevel
                        )}`}
                      >
                        {getInsightStatusLabel(insights.status)}
                      </span>

                      <span className="text-sm text-slate-500">
                        WHO percentile: {insights.latestPercentileBand} · Z-score:{" "}
                        {formatZScore(insights.latestZScore)}
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                      {insights.summary}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Prediction
                        </div>
                        <div className="mt-2 text-sm text-slate-700">
                          {insights.predictionMessage
                            ? insights.predictionMessage
                            : `Forecast generated for next 6 months (${insights.predictedPoints.length} points).`}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          WHO Range
                        </div>
                        <div className="mt-2 text-sm text-slate-700">
                          {insights.withinExpectedWhoRange
                            ? "Current growth is within expected WHO-based range."
                            : "Current growth is below expected WHO-based range."}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Warning signals
                      </div>
                      {insights.anomalies.length === 0 ? (
                        <div className="mt-2 text-sm text-slate-700">
                          No anomaly flags detected in recent growth records.
                        </div>
                      ) : (
                        <ul className="mt-3 space-y-3">
                          {insights.anomalies.map((anomaly) => (
                            <li key={`${anomaly.flag}-${anomaly.explanation}`} className="text-sm">
                              <div className="font-semibold text-slate-800">
                                {getAnomalyFlagLabel(anomaly.flag)}
                              </div>
                              <div className="text-slate-600">{anomaly.explanation}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="text-xs leading-5 text-slate-500">{insights.disclaimer}</div>
                  </div>
                )}
              </div>

              <GrowthStory
                measurements={measurements}
                insights={insights}
              />

              <GrowthSimulator
                measurements={measurements}
                birthDate={selectedChild.birthDate}
                gender={selectedChild.gender as Gender}
                growthRate={simulationGrowthRate}
                monthsAhead={simulationMonthsAhead}
                onGrowthRateChange={setSimulationGrowthRate}
                onMonthsAheadChange={setSimulationMonthsAhead}
              />

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-slate-900">
                      WHO Height-for-age Chart
                    </div>
                    <div className="mt-1 text-lg text-slate-500">
                      WHO reference percentiles + observed and predicted height
                    </div>
                  </div>
                </div>

                <div className="mt-4 h-[300px] w-full rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartDataWithSimulation}>
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
                        dataKey="simulatedHeight"
                        stroke="#7c3aed"
                        strokeWidth={4}
                        strokeDasharray="8 6"
                        dot={{ r: 5 }}
                        connectNulls={true}
                      />

                      <Line
                        type="monotone"
                        dataKey="childHeight"
                        stroke="#0f766e"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        connectNulls={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="predictedHeight"
                        stroke="#0284c7"
                        strokeWidth={3}
                        strokeDasharray="5 5"
                        dot={{ r: 3 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-2xl font-bold text-slate-900">
                        Добавить измерение
                      </div>
                      <div className="mt-1 text-lg leading-6 text-slate-500">
                        Дата, рост и вес сохраняются в базу.
                      </div>
                    </div>

                    {hasInsightWarnings ? (
                      <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-600">
                        Warning signs
                      </span>
                    ) : null}
                  </div>

                  <form onSubmit={handleCreateMeasurement} className="mt-5 space-y-3">
                    <input
                      type="date"
                      value={measurementDate}
                      onChange={(e) => setMeasurementDate(e.target.value)}
                      max={getTodayIsoDate()}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition focus:border-cyan-400"
                    />

                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      value={measurementHeight}
                      onChange={(e) => setMeasurementHeight(e.target.value)}
                      placeholder="Рост (см)"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition focus:border-cyan-400"
                    />

                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={measurementWeight}
                      onChange={(e) => setMeasurementWeight(e.target.value)}
                      placeholder="Вес (кг)"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none transition focus:border-cyan-400"
                    />

                    <button
                      type="submit"
                      disabled={submittingMeasurement}
                      className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 font-semibold text-white transition hover:bg-cyan-600 disabled:opacity-60"
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

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="text-2xl font-bold text-slate-900">
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
                            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <div className="text-base font-medium text-slate-500">
                                {formatDate(measurement.date)}
                              </div>
                            </div>

                            <div className="text-lg font-bold text-slate-900">
                              {safeNumber(measurement.height)} см
                            </div>

                            <div className="text-xl font-bold text-slate-900">
                              {safeNumber(measurement.weight)} кг
                            </div>

                            <button
                              type="button"
                              onClick={() => void handleDeleteMeasurement(measurement.id)}
                              disabled={deletingMeasurementId === measurement.id}
                              className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 text-red-500 transition hover:bg-red-50 disabled:opacity-50"
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

      {isCreateChildOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => {
            setIsCreateChildOpen(false);
            setChildFormError(null);
          }}
        >
          <div
            className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="text-2xl font-bold text-slate-900">Новый профиль ребёнка</div>
                <div className="mt-2 text-base text-slate-500">
                  Добавь имя, пол и дату рождения для старта мониторинга.
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsCreateChildOpen(false);
                  setChildFormError(null);
                }}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Закрыть
              </button>
            </div>

            <form onSubmit={handleCreateChild} className="grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2">
                <div className="mb-2 text-sm font-semibold text-slate-500">Имя ребёнка</div>
                <input
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="Например, Айару"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none transition focus:border-cyan-400"
                />
              </label>

              <label>
                <div className="mb-2 text-sm font-semibold text-slate-500">Пол</div>
                <select
                  value={childGender}
                  onChange={(e) => setChildGender(e.target.value as Gender)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none transition focus:border-cyan-400"
                >
                  <option value="male">Мальчик</option>
                  <option value="female">Девочка</option>
                </select>
              </label>

              <label>
                <div className="mb-2 text-sm font-semibold text-slate-500">Дата рождения</div>
                <input
                  type="date"
                  value={newBirthDate}
                  max={getTodayIsoDate()}
                  onChange={(e) => setNewBirthDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none transition focus:border-cyan-400"
                />
              </label>

              {childFormError ? (
                <div className="md:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                  {childFormError}
                </div>
              ) : null}

              <div className="md:col-span-2 mt-1 flex gap-3">
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
                  Сохранить профиль
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsCreateChildOpen(false);
                    setChildFormError(null);
                  }}
                  className="rounded-2xl border border-slate-200 px-5 py-3 font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}