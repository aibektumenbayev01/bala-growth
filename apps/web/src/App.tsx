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
  Eye,
  EyeOff,

  // Dashboard sidebar
  Home,
  Users,
  SquarePlus,
  ChartNoAxesCombined,
  BookOpen,
  Sparkles,
  FileText,
  LogOut,
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
  changePassword,
  loginDemo,
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
type CurrentUser = {
  id: string;
  email: string;
  createdAt?: string | Date;
};

const [currentUser, setCurrentUser] =
  useState<CurrentUser | null>(null);

const [isAccountOpen, setIsAccountOpen] =
  useState(false);

  const [isChangePasswordOpen, setIsChangePasswordOpen] =
  useState(false);

const [currentPassword, setCurrentPassword] = useState("");
const [newPassword, setNewPassword] = useState("");
const [confirmNewPassword, setConfirmNewPassword] = useState("");

const [passwordError, setPasswordError] =
  useState<string | null>(null);

const [passwordSuccess, setPasswordSuccess] =
  useState<string | null>(null);

const [changingPassword, setChangingPassword] =
  useState(false);


  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [demoLoading, setDemoLoading] = useState(false);

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [insights, setInsights] = useState<ChildGrowthInsights | null>(null);
  type DashboardChildData = {
  measurements: Measurement[];
  insights: ChildGrowthInsights | null;
};

  const [dashboardData, setDashboardData] = useState<
    Record<string, DashboardChildData>
  >({});

  const [, setLoadingChildren] = useState(true);
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
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);


const loadDashboardData = useCallback(
  async (childrenList: Child[]) => {
    try {
      const entries = await Promise.all(
        childrenList.map(async (child) => {
          const [childMeasurements, childInsights] = await Promise.all([
            getMeasurements(child.id),
            getChildInsights(child.id),
          ]);

          return [
            child.id,
            {
              measurements: childMeasurements,
              insights: childInsights,
            },
          ] as const;
        })
      );

      setDashboardData(Object.fromEntries(entries));
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    }
  },
  []
);

const loadChildren = useCallback(async () => {
  try {
    setLoadingChildren(true);

    const data = await getChildren();

    setChildren(data);

    await loadDashboardData(data);

    setSelectedChildId(null);
  } catch (error) {
    console.error("Failed to load children:", error);
  } finally {
    setLoadingChildren(false);
  }
}, [loadDashboardData]);

const loadMeasurements = useCallback(async (childId: string) => {
  try {
    setLoadingMeasurements(true);

    const data = await getMeasurements(childId);

    const sorted = [...data].sort(
      (a, b) =>
        new Date(a.date).getTime() -
        new Date(b.date).getTime()
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

let user;

if (authMode === "login") {
  user = await login(email, password);
} else {
  user = await register(email, password);
}

setCurrentUser(user);
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

async function handleDemoLogin() {
  try {
    setDemoLoading(true);
    setAuthError(null);

    const user = await loginDemo();

    setCurrentUser(user);
    setIsAuthenticated(true);
  } catch (error) {
    if (error instanceof Error) {
      setAuthError(error.message);
    } else {
      setAuthError("Failed to start demo.");
    }
  } finally {
    setDemoLoading(false);
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

  async function handleChangePassword(
  event: FormEvent<HTMLFormElement>
) {
  event.preventDefault();

  setPasswordError(null);
  setPasswordSuccess(null);

  if (!currentPassword || !newPassword || !confirmNewPassword) {
    setPasswordError("Заполни все поля.");
    return;
  }

  if (newPassword.length < 8) {
    setPasswordError(
      "Новый пароль должен содержать минимум 8 символов."
    );
    return;
  }

  if (newPassword !== confirmNewPassword) {
    setPasswordError("Новые пароли не совпадают.");
    return;
  }

  try {
    setChangingPassword(true);

    await changePassword(
      currentPassword,
      newPassword
    );

    setPasswordSuccess("Password changed successfully.");

    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
  } catch (error) {
    if (error instanceof Error) {
      setPasswordError(error.message);
    } else {
      setPasswordError("Failed to change password.");
    }
  } finally {
    setChangingPassword(false);
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

const dashboardStats = useMemo(() => {
  let normalCount = 0;
  let monitoringCount = 0;
  let checkupCount = 0;
  let totalMeasurements = 0;

  children.forEach((child) => {
    const data = dashboardData[child.id];

    if (!data) return;

    totalMeasurements += data.measurements.length;

    if (!data.insights) return;

    if (data.insights.status === "requires_attention") {
      checkupCount += 1;
    } else if (data.insights.status === "below_expected_growth") {
      monitoringCount += 1;
    } else {
      normalCount += 1;
    }
  });

  return {
    totalChildren: children.length,
    normalCount,
    monitoringCount,
    checkupCount,
    totalMeasurements,
  };
}, [children, dashboardData]);


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

                    {authMode === "login" && (
                      <>
                        <div className="my-5 flex items-center gap-3">
                          <div className="h-px flex-1 bg-slate-200" />

                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            or
                          </span>

                          <div className="h-px flex-1 bg-slate-200" />
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleDemoLogin()}
                          disabled={demoLoading}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 font-semibold text-cyan-700 transition hover:bg-cyan-100 disabled:opacity-60"
                        >
                          {demoLoading ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Activity size={18} />
                          )}

                          {demoLoading ? "Loading demo..." : "Try Demo"}
                        </button>
                      </>
                    )}

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
    <div className="mx-auto flex min-h-screen max-w-[1500px] bg-white shadow-sm">

      {/* SIDEBAR */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-5 py-6">

        {/* Logo */}
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 text-white">
            <Activity size={20} />
          </div>

          <div className="font-bold text-slate-900">
            GrowthTrack KZ
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-2">

          <button
            type="button"
            onClick={() => setSelectedChildId(null)}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-semibold transition ${
              selectedChildId === null
                ? "bg-cyan-50 text-cyan-600"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Home size={18} />
            Dashboard
          </button>

          <button
            type="button"
            onClick={() => setSelectedChildId(null)}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-slate-600 transition hover:bg-slate-50"
          >
            <Users size={18} />
            Children
          </button>

          <button
            type="button"
            onClick={() => {
              if (children.length > 0) {
                setSelectedChildId(children[0].id);
              }
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-slate-600 transition hover:bg-slate-50"
          >
            <SquarePlus size={18} />
            Add Measurement
          </button>

          <button
            type="button"
            onClick={() => {
              if (children.length > 0) {
                setSelectedChildId(children[0].id);
              }
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-slate-600 transition hover:bg-slate-50"
          >
            <ChartNoAxesCombined size={18} />
            Growth Charts
          </button>

          <button
            type="button"
            onClick={() => {
              if (children.length > 0) {
                setSelectedChildId(children[0].id);
              }
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-slate-600 transition hover:bg-slate-50"
          >
            <BookOpen size={18} />
            Growth Story
          </button>

          <button
            type="button"
            onClick={() => {
              if (children.length > 0) {
                setSelectedChildId(children[0].id);
              }
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-slate-600 transition hover:bg-slate-50"
          >
            <Sparkles size={18} />
            Simulator
          </button>

          <button
            type="button"
            onClick={() => {
              if (children.length > 0) {
                setSelectedChildId(children[0].id);
              }
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-slate-600 transition hover:bg-slate-50"
          >
            <FileText size={18} />
            Reports
          </button>
        </nav>

        {/* Bottom */}
        <div className="mt-auto space-y-2 pt-8">

          <button
            type="button"
            onClick={() => setIsAccountOpen(true)}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-slate-600 transition hover:bg-slate-50"
          >
            <User size={18} />
            Account
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-slate-600 transition hover:bg-slate-50"
          >
            <LogOut size={18} />
            Logout
          </button>

        </div>
      </aside>

      {/* MAIN */}
      <main className="min-w-0 flex-1">

        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Dashboard
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Overview of your children's growth
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setChildFormError(null);
                setIsCreateChildOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-600"
            >
              <PlusCircle size={17} />
              Add Child
            </button>

            <button
              type="button"
              onClick={() => setIsAccountOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-200 text-cyan-600 transition hover:bg-cyan-50"
            >
              <User size={19} />
            </button>
          </div>
        </header>

        {/* Existing content */}
        <div className="p-8">
          <section className="space-y-8">
          {!selectedChild ? (
         <div className="space-y-7">

  {/* YOUR CHILDREN */}
  <section>
    <div className="mb-5 flex items-center justify-between">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Your Children ({children.length})
        </h2>
      </div>

      <button
        type="button"
        onClick={() => {
          setChildFormError(null);
          setIsCreateChildOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-white px-4 py-2 text-sm font-semibold text-cyan-600 transition hover:bg-cyan-50"
      >
        <PlusCircle size={17} />
        Add Child
      </button>
    </div>

    {children.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <Baby size={30} className="mx-auto text-slate-300" />

        <div className="mt-3 font-semibold text-slate-700">
          No children yet
        </div>

        <div className="mt-1 text-sm text-slate-500">
          Add your first child to start tracking growth.
        </div>
      </div>
    ) : (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {children.map((child) => {
          const ageMonths = getAgeInMonths(
            child.birthDate,
            new Date()
          );

          const dashboardChild = dashboardData[child.id];

          const latestMeasurement =
            dashboardChild?.measurements
              ? [...dashboardChild.measurements]
                  .sort(
                    (a, b) =>
                      new Date(a.date).getTime() -
                      new Date(b.date).getTime()
                  )
                  .at(-1)
              : null;


const childInsights =
  dashboardChild?.insights ?? null;

const status = childInsights?.status;

const hasAnalytics = Boolean(childInsights);

const isCheckup =
  status === "requires_attention";

const isMonitoring =
  status === "below_expected_growth";

const cardBorder = !hasAnalytics
  ? "border-slate-200"
  : isCheckup
    ? "border-red-200"
    : isMonitoring
      ? "border-amber-200"
      : "border-emerald-200";

const avatarClass = !hasAnalytics
  ? "border-slate-200 bg-slate-50 text-slate-400"
  : isCheckup
    ? "border-red-200 bg-red-50 text-red-500"
    : isMonitoring
      ? "border-amber-200 bg-amber-50 text-amber-500"
      : "border-emerald-200 bg-emerald-50 text-emerald-600";

const statusClass = !hasAnalytics
  ? "bg-slate-50 text-slate-500"
  : isCheckup
    ? "bg-red-50 text-red-600"
    : isMonitoring
      ? "bg-amber-50 text-amber-600"
      : "bg-emerald-50 text-emerald-600";

 const statusText = !hasAnalytics
  ? "No analytics yet"
  : isCheckup
    ? "Needs Check-up"
    : isMonitoring
      ? "Requires Monitoring"
      : "All Good";

          return (
            <div
              key={child.id}
              className={`overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-0.5 hover:shadow-md ${cardBorder}`}
            >
              <div className="p-5">

                {/* Child */}
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border ${avatarClass}`}
                  >
                    <Baby size={27} />
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-lg font-bold text-slate-900">
                      {child.name}
                    </div>

                    <div className="mt-1 text-sm text-slate-500">
                      {child.gender === "male"
                        ? "Male"
                        : "Female"}
                      , {formatAge(ageMonths)}
                    </div>

                    <div className="mt-1 text-sm text-slate-500">
                      Born: {formatDate(child.birthDate)}
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div
                  className={`mt-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${statusClass}`}
                >
                  <span className="text-lg">●</span>
                  {statusText}
                </div>

                {/* Measurement */}
                <div className="mt-5 space-y-2 text-base text-slate-600">
                  <div>
                    Height:{" "}
                    <span className="font-semibold text-slate-800">
                      {latestMeasurement
                        ? `${safeNumber(
                            latestMeasurement.height
                          )} cm`
                        : "—"}
                    </span>

                    {childInsights ? (
                      <span
                        className={`ml-2 font-bold ${
                          isCheckup
                            ? "text-red-500"
                            : isMonitoring
                              ? "text-amber-500"
                              : "text-emerald-600"
                        }`}
                      >
                        ({childInsights.latestPercentileBand})
                      </span>
                    ) : null}
                  </div>

                  <div>
                    Weight:{" "}
                    <span className="font-semibold text-slate-800">
                      {latestMeasurement
                        ? `${safeNumber(
                            latestMeasurement.weight
                          )} kg`
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Button */}
            {/* Card actions */}
                <div className="flex border-t border-slate-100 bg-slate-50/70">
                  <button
                    type="button"
                    onClick={() => setSelectedChildId(child.id)}
                    className="flex flex-1 items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
                  >
                    View Details
                    <span>→</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void handleDeleteChild(child.id, child.name)
                    }
                    className="flex items-center justify-center border-l border-slate-200 px-4 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                    title="Delete child"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
            </div>
          );
        })}
      </div>
    )}
  </section>

  {/* BOTTOM GRID */}
  <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.9fr)]">

    {/* GROWTH SUMMARY */}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">
        Growth Summary
      </h2>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">

        {/* GOOD */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
            <span>●</span>
            All Good
          </div>

          <div className="mt-5 text-center">
            <div className="text-3xl font-bold text-slate-900">
              {dashboardStats.normalCount}
            </div>

            <div className="mt-1 text-sm text-slate-500">
              {dashboardStats.normalCount === 1
                ? "child"
                : "children"}
            </div>
          </div>
        </div>

        

        {/* MONITORING */}
        <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-600">
            <span>●</span>
            Requires Monitoring
          </div>

          <div className="mt-5 text-center">
            <div className="text-3xl font-bold text-slate-900">
              {dashboardStats.monitoringCount}
            </div>

            <div className="mt-1 text-sm text-slate-500">
              {dashboardStats.monitoringCount === 1
                ? "child"
                : "children"}
            </div>
          </div>
        </div>
        
        

        {/* CHECKUP */}
        <div className="rounded-xl border border-red-100 bg-red-50/60 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-600">
            <span>●</span>
            Needs Check-up
          </div>

          <div className="mt-5 text-center">
            <div className="text-3xl font-bold text-slate-900">
              {dashboardStats.checkupCount}
            </div>

            <div className="mt-1 text-sm text-slate-500">
              {dashboardStats.checkupCount === 1
                ? "child"
                : "children"}
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* QUICK ACTIONS */}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">
        Quick Actions
      </h2>

      <div className="mt-4 divide-y divide-slate-100">

        <button
          type="button"
          onClick={() => {
            if (children.length > 0) {
              setSelectedChildId(children[0].id);
            }
          }}
          className="flex w-full items-center justify-between py-4 text-left"
        >
          <div className="flex items-center gap-3 font-semibold text-cyan-600">
            <PlusCircle size={18} />
            Add Measurement
          </div>

          <span className="text-slate-400">›</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (children.length > 0) {
              setSelectedChildId(children[0].id);
            }
          }}
          className="flex w-full items-center justify-between py-4 text-left"
        >
          <div className="flex items-center gap-3 font-semibold text-cyan-600">
            <ChartNoAxesCombined size={18} />
            View Growth Charts
          </div>

          <span className="text-slate-400">›</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (children.length > 0) {
              setSelectedChildId(children[0].id);
            }
          }}
          className="flex w-full items-center justify-between py-4 text-left"
        >
          <div className="flex items-center gap-3 font-semibold text-cyan-600">
            <FileText size={18} />
            Generate Report
          </div>

          <span className="text-slate-400">›</span>
        </button>

      </div>
    </section>
  </div>

  {/* DEMO BANNER */}
  {currentUser?.email === "demo@growthtrack.kz" ? (
    <div className="flex items-start gap-4 rounded-2xl border border-blue-200 bg-blue-50/50 px-5 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
        <Activity size={18} />
      </div>

      <div>
        <div className="font-semibold text-blue-600">
          This is a demo account
        </div>

        <div className="mt-1 text-sm text-slate-500">
          You can explore all features with sample data.
          Demo data may be reset between sessions.
        </div>
      </div>
    </div>
  ) : null}

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

                    <div
                      id="who-growth-chart"
                      className="mt-4 h-[300px] w-full rounded-2xl border border-slate-100 bg-slate-50 p-3"
                    >
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
      </div>
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

       {isAccountOpen ? (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
                    onClick={() => setIsAccountOpen(false)}
                  >
                    <div
                      className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                            <User size={26} />
                          </div>

                          <div>
                            <h2 className="text-2xl font-bold text-slate-900">
                              My Account
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                              Account and profile settings
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsAccountOpen(false)}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
                        >
                          Close
                        </button>
                      </div>

                      <div className="mt-6 space-y-3">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                            Email
                          </div>

                          <div className="mt-2 font-semibold text-slate-900">
                            {currentUser?.email ?? "—"}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                              Children
                            </div>

                            <div className="mt-2 text-2xl font-bold text-slate-900">
                              {children.length}
                            </div>
                          </div>

                          <div className="rounded-2xl bg-slate-50 p-4">
                            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                              Measurements
                            </div>

                            <div className="mt-2 text-2xl font-bold text-slate-900">
                              {dashboardStats.totalMeasurements}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 space-y-3">
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordError(null);
                            setPasswordSuccess(null);
                            setIsChangePasswordOpen(true);
                          }}
                          className="w-full rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
                        >
                          Change password
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsAccountOpen(false);
                            handleLogout();
                          }}
                          className="w-full rounded-2xl border border-red-200 px-5 py-3 font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          Logout
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
                {isChangePasswordOpen ? (
                <div
                  className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
                  onClick={() => setIsChangePasswordOpen(false)}
                >
                  <div
                    className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900">
                          Change password
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          Enter your current password and choose a new one.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIsChangePasswordOpen(false);
                          setPasswordError(null);
                          setPasswordSuccess(null);
                        }}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
                      >
                        Close
                      </button>
                    </div>

                    <form
                      onSubmit={handleChangePassword}
                      className="mt-6 space-y-4"
                    >
                            <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-600">
                      Current password
                    </label>

                    <div className="relative">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(event) =>
                          setCurrentPassword(event.target.value)
                        }
                        placeholder="Current password"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 outline-none transition focus:border-cyan-400"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowCurrentPassword((prev) => !prev)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        {showCurrentPassword ? (
                          <EyeOff size={19} />
                        ) : (
                          <Eye size={19} />
                        )}
                      </button>
                    </div>
                  </div>

                   <div>
  <label className="mb-2 block text-sm font-semibold text-slate-600">
    New password
  </label>

  <div className="relative">
    <input
      type={showNewPassword ? "text" : "password"}
      value={newPassword}
      onChange={(event) =>
        setNewPassword(event.target.value)
      }
      placeholder="Minimum 8 characters"
      className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 outline-none transition focus:border-cyan-400"
    />

    <button
      type="button"
      onClick={() =>
        setShowNewPassword((prev) => !prev)
      }
      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
    >
      {showNewPassword ? (
        <EyeOff size={19} />
      ) : (
        <Eye size={19} />
      )}
    </button>
  </div>
</div>

                    <div>
  <label className="mb-2 block text-sm font-semibold text-slate-600">
    Confirm new password
  </label>

  <div className="relative">
    <input
      type={showConfirmPassword ? "text" : "password"}
      value={confirmNewPassword}
      onChange={(event) =>
        setConfirmNewPassword(event.target.value)
      }
      placeholder="Repeat new password"
      className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 outline-none transition focus:border-cyan-400"
    />

    <button
      type="button"
      onClick={() =>
        setShowConfirmPassword((prev) => !prev)
      }
      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
    >
      {showConfirmPassword ? (
        <EyeOff size={19} />
      ) : (
        <Eye size={19} />
      )}
    </button>
  </div>
</div>

                      {passwordError ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                          {passwordError}
                        </div>
                      ) : null}

                      {passwordSuccess ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                          {passwordSuccess}
                        </div>
                      ) : null}

                      <button
                        type="submit"
                        disabled={changingPassword}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
                      >
                        {changingPassword ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : null}

                        Update password
                      </button>
                    </form>
                  </div>
                </div>
                   ) : null}

    </div>
  </div>
);
}