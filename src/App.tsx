import {
  prepareChildHeightMeasurements,
  prepareChartData,
  getAgeInMonths,
  getNearestWhoRow,
  getHeightPercentileBand,
} from "./lib/growth";
import { hfaBoys5to19 } from "./who/hfa-boys-5-19";
import { hfaGirls5to19 } from "./who/hfa-girls-5-19";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
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

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function normalizeChild(child: Child): Child {
  return {
    ...child,
    birthDate: toDate(child.birthDate),
  };
}

function normalizeMeasurement(measurement: Measurement): Measurement {
  return {
    ...measurement,
    date: toDate(measurement.date),
  };
}

function formatRuDate(d: Date | string) {
  return toDate(d).toLocaleDateString("ru-RU");
}

function getAgeText(birthDate: Date | string) {
  const birth = toDate(birthDate);
  const now = new Date();

  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();

  if (now.getDate() < birth.getDate()) {
    months -= 1;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return `${years} г ${months} мес`;
}

const ui = {
  page: "min-h-screen bg-[#f6f8f8] text-slate-900",
  shell: "flex min-h-screen w-full flex-col",
  header:
    "sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80",
  headerInner:
    "mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 md:px-6",
  brandIcon:
    "flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 text-white shadow-sm",
  mainWrap: "mx-auto flex w-full max-w-7xl flex-1 gap-0",
  sidebar:
    "hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col",
  sidebarInner: "flex h-full flex-col p-4",
  sideLink:
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900",
  sideLinkActive:
    "flex items-center gap-3 rounded-xl bg-cyan-50 px-3 py-2.5 text-sm font-semibold text-cyan-700",
  main: "min-w-0 flex-1 p-4 md:p-6 lg:p-8",
  card: "rounded-2xl border border-slate-200 bg-white shadow-sm",
  cardPad: "p-5 md:p-6",
  muted: "text-slate-500",
  danger:
    "rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700",
  ghostBtn:
    "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50",
  primaryBtn:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60",
  input:
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100",
  statCard: "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
  tableRow:
    "grid grid-cols-[1.3fr_1fr_1fr_auto] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm",
};

type StatCardProps = {
  title: string;
  value: string | number;
  suffix?: string;
  icon: ReactNode;
  note?: string;
};

function StatCard({ title, value, suffix, icon, note }: StatCardProps) {
  return (
    <div className={ui.statCard}>
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
          {icon}
        </div>
      </div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <div className="mt-1 flex items-end gap-1">
        <h3 className="text-2xl font-black text-slate-900">{value}</h3>
        {suffix ? (
          <span className="pb-1 text-sm text-slate-500">{suffix}</span>
        ) : null}
      </div>
      {note ? <p className="mt-2 text-xs text-slate-500">{note}</p> : null}
    </div>
  );
}

export default function App() {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGender, setNewGender] = useState<"male" | "female">("male");
  const [newBirthDate, setNewBirthDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );

  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [mDate, setMDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );

  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingMeasurements, setLoadingMeasurements] = useState(false);
  const [savingChild, setSavingChild] = useState(false);
  const [savingMeasurement, setSavingMeasurement] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [chartTab, setChartTab] = useState<"height" | "weight">("height");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setError(null);
        setLoadingChildren(true);

        const list = await getChildren();
        if (!alive) return;

        const normalized = list.map(normalizeChild);
        setChildren(normalized);

        if (normalized.length > 0) {
          setSelectedChild(normalized[0]);
        }
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load children");
      } finally {
        if (!alive) return;
        setLoadingChildren(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!selectedChild) return;

      try {
        setError(null);
        setLoadingMeasurements(true);

        const list = await getMeasurements(selectedChild.id);
        if (!alive) return;

        setMeasurements(list.map(normalizeMeasurement));
      } catch (e) {
        if (!alive) return;
        setError(
          e instanceof Error ? e.message : "Failed to load measurements"
        );
      } finally {
        if (!alive) return;
        setLoadingMeasurements(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedChild]);

  const handleAddChild = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setError(null);
      setSavingChild(true);

      const created = await createChild({
        name: newName.trim(),
        gender: newGender,
        birthDate: new Date(newBirthDate),
      });

      const normalized = normalizeChild(created);

      setChildren((prev) => [normalized, ...prev]);
      setSelectedChild(normalized);

      setNewName("");
      setNewGender("male");
      setNewBirthDate(new Date().toISOString().slice(0, 10));
      setIsFormOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create child");
    } finally {
      setSavingChild(false);
    }
  };

  const handleDeleteMeasurement = async (id: string) => {
    try {
      setError(null);
      await deleteMeasurement(id);
      setMeasurements((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to delete measurement"
      );
    }
  };

  const handleAddMeasurement = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedChild) return;

    const h = Number(height);
    const w = Number(weight);

    if (!Number.isFinite(h) || !Number.isFinite(w)) return;
    if (h <= 0 || w <= 0) return;

    try {
      setError(null);
      setSavingMeasurement(true);

      const created = await createMeasurement(selectedChild.id, {
        date: new Date(mDate),
        height: h,
        weight: w,
      });

      const normalized = normalizeMeasurement(created);

      setMeasurements((prev) => [...prev, normalized]);
      setHeight("");
      setWeight("");
      setMDate(new Date().toISOString().slice(0, 10));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create measurement");
    } finally {
      setSavingMeasurement(false);
    }
  };

  const childMeasurements = useMemo(() => {
    return measurements
      .slice()
      .map(normalizeMeasurement)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [measurements]);

  const whoHeightData = useMemo(() => {
    if (!selectedChild) return [];
    return selectedChild.gender === "female" ? hfaGirls5to19 : hfaBoys5to19;
  }, [selectedChild]);

  const childHeightData = useMemo(() => {
    if (!selectedChild) return [];
    return prepareChildHeightMeasurements(
      selectedChild.birthDate,
      childMeasurements
    );
  }, [selectedChild, childMeasurements]);

  const chartData = useMemo(() => {
    if (!selectedChild) return [];
    return prepareChartData(whoHeightData, childHeightData);
  }, [selectedChild, whoHeightData, childHeightData]);

  const weightChartData = useMemo(() => {
  if (!selectedChild) return [];

  return childMeasurements.map((m) => ({
    ageMonths: getAgeInMonths(selectedChild.birthDate, m.date),
    weight: m.weight,
  }));
}, [selectedChild, childMeasurements]);

  const last = childMeasurements.at(-1);
  const prev = childMeasurements.length >= 2 ? childMeasurements.at(-2) : null;

  const heightDelta =
    last && prev ? Math.round((last.height - prev.height) * 10) / 10 : null;
  const weightDelta =
    last && prev ? Math.round((last.weight - prev.weight) * 10) / 10 : null;

  const currentHeight = last?.height ?? "—";
  const currentWeight = last?.weight ?? "—";

  const lastHeightPercentileBand =
    selectedChild && last
      ? getHeightPercentileBand(
          last.height,
          getNearestWhoRow(
            whoHeightData,
            getAgeInMonths(selectedChild.birthDate, last.date)
          )
        )
      : "—";

  return (
    <div className={ui.page}>
      <div className={ui.shell}>
        <header className={ui.header}>
          <div className={ui.headerInner}>
            <div className="flex items-center gap-3">
              <div className={ui.brandIcon}>
                <Activity size={20} />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-slate-900">
                  GrowthTrack KZ
                </h1>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Pediatric Health Platform
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!selectedChild ? (
                <button
                  onClick={() => setIsFormOpen(true)}
                  className={ui.primaryBtn}
                >
                  <PlusCircle size={18} />
                  Добавить ребёнка
                </button>
              ) : (
                <button
                  onClick={() => setSelectedChild(null)}
                  className={ui.ghostBtn}
                >
                  <ArrowLeft size={18} />
                  К списку
                </button>
              )}
            </div>
          </div>
        </header>

        <div className={ui.mainWrap}>
          <aside className={ui.sidebar}>
            <div className={ui.sidebarInner}>
              <nav className="flex flex-1 flex-col gap-1">
                <div className={ui.sideLinkActive}>
                  <Activity size={18} />
                  Dashboard
                </div>
                <div className={ui.sideLink}>
                  <TrendingUp size={18} />
                  Growth History
                </div>
                <div className={ui.sideLink}>
                  <Baby size={18} />
                  Children
                </div>
                <div className={ui.sideLink}>
                  <Calendar size={18} />
                  Appointments
                </div>
              </nav>

              <div className="mt-auto border-t border-slate-200 pt-4">
                <div className="rounded-2xl bg-cyan-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">
                    Reminder
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    Следующее измерение желательно внести через 2–4 недели.
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <main className={ui.main}>
            {error && <div className={`${ui.danger} mb-6`}>{error}</div>}

            {!selectedChild ? (
              <div className="space-y-8">
                <section className={`${ui.card} ${ui.cardPad}`}>
                  <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                        Мониторинг роста детей
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm text-slate-500">
                        Добавляй профили детей, сохраняй измерения роста и веса,
                        смотри историю и графики в одном месте.
                      </p>
                    </div>

                    <button
                      onClick={() => setIsFormOpen(true)}
                      className={ui.primaryBtn}
                    >
                      <PlusCircle size={18} />
                      Новый профиль
                    </button>
                  </div>
                </section>

                {isFormOpen && (
                  <form
                    onSubmit={handleAddChild}
                    className={`${ui.card} ${ui.cardPad} max-w-2xl`}
                  >
                    <div className="mb-5">
                      <h3 className="text-lg font-bold text-slate-900">
                        Новый ребёнок
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Создай профиль и начни вести историю измерений.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <input
                        autoFocus
                        className={ui.input}
                        placeholder="Имя ребёнка"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        required
                        minLength={2}
                      />

                      <select
                        className={ui.input}
                        value={newGender}
                        onChange={(e) =>
                          setNewGender(e.target.value as "male" | "female")
                        }
                      >
                        <option value="male">Мальчик</option>
                        <option value="female">Девочка</option>
                      </select>

                      <input
                        type="date"
                        className={ui.input}
                        value={newBirthDate}
                        onChange={(e) => setNewBirthDate(e.target.value)}
                        required
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={savingChild}
                        className={ui.primaryBtn}
                      >
                        {savingChild && (
                          <Loader2 className="animate-spin" size={16} />
                        )}
                        Сохранить
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsFormOpen(false)}
                        className={ui.ghostBtn}
                      >
                        Отмена
                      </button>
                    </div>
                  </form>
                )}

                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">
                      Профили детей
                    </h3>
                    {!loadingChildren && (
                      <span className="text-sm text-slate-500">
                        {children.length} профилей
                      </span>
                    )}
                  </div>

                  {loadingChildren ? (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Loader2 className="animate-spin" size={16} />
                      Загрузка детей...
                    </div>
                  ) : children.length === 0 ? (
                    <div className={`${ui.card} ${ui.cardPad} py-14 text-center`}>
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                        <Baby size={28} />
                      </div>
                      <p className="text-base font-semibold text-slate-900">
                        Список детей пуст
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        Начни с создания первого профиля.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                      {children.map((child) => (
                        <div
                          key={child.id}
                          className={`${ui.card} ${ui.cardPad} transition hover:-translate-y-0.5 hover:shadow-md`}
                        >
                          <div className="mb-4 flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500 text-white">
                              <Baby size={22} />
                            </div>

                            <div>
                              <h4 className="text-lg font-semibold text-slate-900">
                                {child.name}
                              </h4>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {child.gender === "male" ? "Мальчик" : "Девочка"}
                              </p>
                            </div>
                          </div>

                          <div className="mb-5 flex items-center gap-2 text-sm text-slate-500">
                            <Calendar size={16} />
                            {formatRuDate(child.birthDate)} •{" "}
                            {getAgeText(child.birthDate)}
                          </div>

                          <button
                            onClick={() => setSelectedChild(child)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700"
                          >
                            Открыть профиль
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <div className="space-y-6">
                <section className={`${ui.card} ${ui.cardPad}`}>
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-cyan-100 bg-cyan-50 text-cyan-600">
                        <User size={34} />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-2xl font-bold text-slate-900">
                            {selectedChild.name}
                          </h2>
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            ID: {selectedChild.id.slice(0, 6)}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar size={15} />
                            {getAgeText(selectedChild.birthDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Baby size={15} />
                            {selectedChild.gender === "male"
                              ? "Мальчик"
                              : "Девочка"}
                          </span>
                          <span>
                            Дата рождения: {formatRuDate(selectedChild.birthDate)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedChild(null);
                        setMeasurements([]);
                      }}
                      className={ui.ghostBtn}
                    >
                      <ArrowLeft size={18} />
                      Назад
                    </button>
                  </div>
                </section>

                <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <StatCard
                    title="Current Height"
                    value={currentHeight}
                    suffix={currentHeight === "—" ? "" : "см"}
                    icon={<Ruler size={20} />}
                    note={
                      heightDelta !== null
                        ? `Изменение: ${heightDelta > 0 ? "+" : ""}${heightDelta} см`
                        : "Недостаточно данных"
                    }
                  />

                  <StatCard
                    title="Current Weight"
                    value={currentWeight}
                    suffix={currentWeight === "—" ? "" : "кг"}
                    icon={<Weight size={20} />}
                    note={
                      weightDelta !== null
                        ? `Изменение: ${weightDelta > 0 ? "+" : ""}${weightDelta} кг`
                        : "Недостаточно данных"
                    }
                  />

                  <StatCard
                    title="Height Percentile"
                    value={lastHeightPercentileBand}
                    icon={<TrendingUp size={20} />}
                    note="По WHO height-for-age"
                  />

                  <StatCard
                    title="Measurements"
                    value={childMeasurements.length}
                    icon={<TrendingUp size={20} />}
                    note="Всего записей в истории"
                  />

                  <StatCard
                    title="Last Measurement"
                    value={last ? formatRuDate(last.date) : "—"}
                    icon={<Calendar size={20} />}
                    note="Последняя зафиксированная дата"
                  />
                </section>

                <section className={`${ui.card} overflow-hidden`}>
                  <div className="border-b border-slate-200 p-5 md:p-6">
  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <h3 className="text-lg font-bold text-slate-900">
        {chartTab === "height" ? "WHO Height-for-age Chart" : "Weight Chart"}
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        {chartTab === "height"
          ? "WHO reference percentiles + рост ребёнка"
          : "История изменения веса по возрасту"}
      </p>
    </div>

    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setChartTab("height")}
        className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
          chartTab === "height"
            ? "bg-cyan-500 text-white"
            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        Рост (WHO)
      </button>

      <button
        type="button"
        onClick={() => setChartTab("weight")}
        className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
          chartTab === "weight"
            ? "bg-cyan-500 text-white"
            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        Вес
      </button>
    </div>
  </div>
</div>

                  <div className="p-5 md:p-6">
  <div className="h-[360px] rounded-xl border border-slate-200 bg-slate-50 p-3">
    {loadingMeasurements ? (
      <div className="flex h-full items-center justify-center text-slate-500">
        <Loader2 className="mr-2 animate-spin" size={16} />
        Загрузка...
      </div>
    ) : chartTab === "height" ? (
      chartData.length < 2 ? (
        <div className="flex h-full items-center justify-center text-slate-500">
          Добавь хотя бы 2 измерения, чтобы увидеть график роста
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 18, left: 0, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

            <XAxis
              dataKey="ageMonths"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fill: "#64748b", fontSize: 12 }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={{ stroke: "#cbd5e1" }}
              tickFormatter={(value) => {
                const years = Math.floor(Number(value) / 12);
                const months = Number(value) % 12;
                return `${years}г ${months}м`;
              }}
            />

            <YAxis
              yAxisId="left"
              width={44}
              tick={{ fill: "#64748b", fontSize: 12 }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={{ stroke: "#cbd5e1" }}
            />

            <Tooltip
              contentStyle={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 16,
                color: "#0f172a",
              }}
              labelStyle={{ color: "#334155" }}
              labelFormatter={(value) => {
                const years = Math.floor(Number(value) / 12);
                const months = Number(value) % 12;
                return `Возраст: ${years} г ${months} мес`;
              }}
              formatter={(value, name) => {
                if (name === "childHeight") {
                  return [`${value} см`, "Рост ребёнка"];
                }
                if (name === "p3") return [`${value} см`, "WHO 3rd"];
                if (name === "p15") return [`${value} см`, "WHO 15th"];
                if (name === "p50") return [`${value} см`, "WHO 50th"];
                if (name === "p85") return [`${value} см`, "WHO 85th"];
                if (name === "p97") return [`${value} см`, "WHO 97th"];
                return [value as string, name as string];
              }}
            />

            <Line
              yAxisId="left"
              type="monotone"
              dataKey="p3"
              stroke="#e2e8f0"
              dot={false}
              strokeWidth={2}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="p15"
              stroke="#cbd5e1"
              dot={false}
              strokeWidth={2}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="p50"
              stroke="#94a3b8"
              dot={false}
              strokeWidth={2.5}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="p85"
              stroke="#cbd5e1"
              dot={false}
              strokeWidth={2}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="p97"
              stroke="#e2e8f0"
              dot={false}
              strokeWidth={2}
            />

            <Line
              yAxisId="left"
              type="monotone"
              dataKey="childHeight"
              dot={{ r: 4 }}
              stroke="#06b6d4"
              strokeWidth={3}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )
    ) : weightChartData.length < 2 ? (
      <div className="flex h-full items-center justify-center text-slate-500">
        Добавь хотя бы 2 измерения, чтобы увидеть график веса
      </div>
    ) : (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={weightChartData}
          margin={{ top: 10, right: 18, left: 0, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

          <XAxis
            dataKey="ageMonths"
            type="number"
            domain={["dataMin", "dataMax"]}
            tick={{ fill: "#64748b", fontSize: 12 }}
            axisLine={{ stroke: "#cbd5e1" }}
            tickLine={{ stroke: "#cbd5e1" }}
            tickFormatter={(value) => {
              const years = Math.floor(Number(value) / 12);
              const months = Number(value) % 12;
              return `${years}г ${months}м`;
            }}
          />

          <YAxis
            width={44}
            tick={{ fill: "#64748b", fontSize: 12 }}
            axisLine={{ stroke: "#cbd5e1" }}
            tickLine={{ stroke: "#cbd5e1" }}
          />

          <Tooltip
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 16,
              color: "#0f172a",
            }}
            labelStyle={{ color: "#334155" }}
            labelFormatter={(value) => {
              const years = Math.floor(Number(value) / 12);
              const months = Number(value) % 12;
              return `Возраст: ${years} г ${months} мес`;
            }}
            formatter={(value) => [`${value} кг`, "Вес"]}
          />

          <Line
            type="monotone"
            dataKey="weight"
            dot={{ r: 4 }}
            stroke="#8b5cf6"
            strokeWidth={3}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    )}
  </div>
</div>
                </section>

                <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                  <form
                    onSubmit={handleAddMeasurement}
                    className={`${ui.card} ${ui.cardPad} xl:col-span-1`}
                  >
                    <div className="mb-4">
                      <h3 className="text-base font-bold text-slate-900">
                        Добавить измерение
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Дата, рост и вес сохраняются в базу.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <input
                        type="date"
                        value={mDate}
                        onChange={(e) => setMDate(e.target.value)}
                        className={ui.input}
                        required
                      />
                      <input
                        type="number"
                        placeholder="Рост (см)"
                        value={height}
                        onChange={(e) => setHeight(e.target.value)}
                        className={ui.input}
                        required
                        min={30}
                        max={250}
                      />
                      <input
                        type="number"
                        placeholder="Вес (кг)"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        className={ui.input}
                        required
                        min={1}
                        max={200}
                        step="0.1"
                      />
                    </div>

                    <div className="mt-4">
                      <button
                        disabled={savingMeasurement}
                        className={ui.primaryBtn}
                        type="submit"
                      >
                        {savingMeasurement && (
                          <Loader2 className="animate-spin" size={16} />
                        )}
                        Сохранить
                      </button>
                    </div>
                  </form>

                  <div className={`${ui.card} ${ui.cardPad} xl:col-span-2`}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 className="text-base font-bold text-slate-900">
                        История измерений
                      </h3>
                      <span className="text-xs font-semibold text-slate-500">
                        {childMeasurements.length} записей
                      </span>
                    </div>

                    {loadingMeasurements ? (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Loader2 className="animate-spin" size={16} />
                        Загрузка...
                      </div>
                    ) : childMeasurements.length === 0 ? (
                      <p className="text-sm text-slate-500">Нет данных измерений</p>
                    ) : (
                      <div className="space-y-3">
                        {childMeasurements
                          .slice()
                          .reverse()
                          .map((m) => (
                            <div key={m.id} className={ui.tableRow}>
                              <span className="text-slate-600">
                                {formatRuDate(m.date)}
                              </span>

                              <span className="font-semibold text-slate-900">
                                {m.height} см
                              </span>

                              <span className="font-semibold text-slate-900">
                                {m.weight} кг
                              </span>

                              <button
                                type="button"
                                onClick={() => handleDeleteMeasurement(m.id)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </section>

                <footer className="pt-4 text-center text-xs text-slate-500">
                  GrowthTrack Kazakhstan • React + Tailwind + Express + Prisma
                </footer>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}