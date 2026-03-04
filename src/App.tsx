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

import { deleteMeasurement } from "./api";
import { Trash2 } from "lucide-react";

import {
  getChildren,
  createChild,
  getMeasurements,
  createMeasurement,
} from "./api";

type ChartPoint = {
  ts: number;
  height: number;
  weight: number;
};

function formatRuDate(d: Date) {
  return d.toLocaleDateString("ru-RU");
}

const ui = {
  page:
    "min-h-screen bg-[#0a0a0f] text-white p-6 selection:bg-blue-500/30 selection:text-white",
  container: "mx-auto w-full max-w-5xl",
  card:
    "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.35)]",
  cardPad: "p-6",
  muted: "text-slate-400",
  subtle: "text-slate-300",
  danger:
    "rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-red-200",
  ghostBtn:
    "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10 hover:border-white/20",
  primaryBtn:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/15 transition hover:scale-[1.02] hover:shadow-blue-500/25 disabled:opacity-60 disabled:hover:scale-100",
  input:
    "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500 outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20",
  hint:
    "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400",
};

export default function App() {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);

  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  const [mDate, setMDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingMeasurements, setLoadingMeasurements] = useState(false);
  const [savingChild, setSavingChild] = useState(false);
  const [savingMeasurement, setSavingMeasurement] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // -------------------- initial load children --------------------
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setError(null);
        setLoadingChildren(true);

        const list = await getChildren();
        if (!alive) return;

        setChildren(list);

        // автоселект первого ребёнка
        if (list.length > 0) setSelectedChild(list[0]);
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

  // -------------------- load measurements when child selected --------------------
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!selectedChild) return;

      try {
        setError(null);
        setLoadingMeasurements(true);

        const list = await getMeasurements(selectedChild.id);
        if (!alive) return;

        setMeasurements(list);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load measurements");
      } finally {
        if (!alive) return;
        setLoadingMeasurements(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedChild]);

  // -------------------- add child --------------------
  const handleAddChild = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setError(null);
      setSavingChild(true);

      const created = await createChild({
        name: newName.trim(),
        gender: "male",
        birthDate: new Date(), // пока "сегодня"
      });

      setChildren((prev) => [created, ...prev]);
      setNewName("");
      setIsFormOpen(false);

      // удобно: сразу открыть нового ребёнка
      setSelectedChild(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create child");
    } finally {
      setSavingChild(false);
    }
  };
  const handleDeleteMeasurement = async (id: string) => {
  try {
    await deleteMeasurement(id);

    setMeasurements((prev) => prev.filter((m) => m.id !== id));
  } catch (e) {
    setError(e instanceof Error ? e.message : "Failed to delete measurement");
  }
};
  // -------------------- add measurement --------------------
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

      setMeasurements((prev) => [...prev, created]);
      setHeight("");
      setWeight("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create measurement");
    } finally {
      setSavingMeasurement(false);
    }
  };

  // -------------------- derived --------------------
  const childMeasurements = useMemo(() => {
    return measurements.slice().sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [measurements]);

  const chartData: ChartPoint[] = useMemo(() => {
    return childMeasurements.map((m) => ({
      ts: m.date.getTime(),
      height: m.height,
      weight: m.weight,
    }));
  }, [childMeasurements]);

  // =============================================================
  // ======================= DETAIL PAGE =========================
  // =============================================================
  if (selectedChild) {
    const last = childMeasurements.at(-1);
    const prev = childMeasurements.length >= 2 ? childMeasurements.at(-2) : null;

    const heightDelta =
      last && prev ? Math.round((last.height - prev.height) * 10) / 10 : null;
    const weightDelta =
      last && prev ? Math.round((last.weight - prev.weight) * 10) / 10 : null;

    return (
      <div className={ui.page}>
        <div className={ui.container}>
          <div className="mb-8 flex items-center justify-between gap-3">
            <button
              onClick={() => {
                setSelectedChild(null);
                setMeasurements([]);
              }}
              className={ui.ghostBtn}
            >
              <ArrowLeft size={18} /> Назад
            </button>

            <div className="flex items-center gap-2">
              <div className="hidden sm:block">
                <div className="text-sm font-semibold text-white/90">
                  Bala Growth Monitor
                </div>
                <div className={`text-xs ${ui.muted}`}>Дети • измерения • графики</div>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20" />
            </div>
          </div>

          {error && <div className={`${ui.danger} mb-6`}>{error}</div>}

          <div className={`${ui.card} ${ui.cardPad} mb-6`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                    <Baby />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{selectedChild.name}</h2>
                    <p className={`mt-1 text-sm ${ui.muted}`}>
                      Дата рождения: {formatRuDate(selectedChild.birthDate)}
                    </p>
                  </div>
                </div>
              </div>

              {loadingMeasurements ? (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Loader2 className="animate-spin" size={16} /> Загрузка измерений...
                </div>
              ) : last ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
                  <p className={`text-xs ${ui.muted}`}>Последнее измерение</p>
                  <p className="mt-1 text-sm font-semibold text-white/90">
                    {formatRuDate(last.date)} • {last.height} см • {last.weight} кг
                  </p>
                  <p className={`mt-1 text-xs ${ui.muted}`}>
                    Δ рост: {heightDelta ?? "—"} см • Δ вес: {weightDelta ?? "—"} кг
                  </p>
                </div>
              ) : (
                <div className={`text-right text-sm ${ui.muted}`}>Пока нет измерений</div>
              )}
            </div>
          </div>

          {/* CHART */}
          <div className={`${ui.card} ${ui.cardPad} mb-8`}>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="text-white/80" size={18} />
                  <h3 className="text-lg font-bold">График роста и веса</h3>
                </div>
                <p className={`mt-1 text-sm ${ui.muted}`}>
                  Данные из Postgres через API
                </p>
              </div>

              <div className={ui.hint}>Наведи на точку</div>
            </div>

            <div className="h-[340px]">
              {loadingMeasurements ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 text-slate-400">
                  Загрузка…
                </div>
              ) : chartData.length < 2 ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 text-slate-400">
                  Добавь хотя бы 2 измерения, чтобы увидеть график
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" />
                    <XAxis
                      dataKey="ts"
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      tick={{ fill: "rgba(148,163,184,0.9)", fontSize: 12 }}
                      axisLine={{ stroke: "rgba(255,255,255,0.10)" }}
                      tickLine={{ stroke: "rgba(255,255,255,0.10)" }}
                      tickFormatter={(ts) => new Date(ts).toLocaleDateString("ru-RU")}
                    />
                    <YAxis
                      yAxisId="left"
                      width={44}
                      tick={{ fill: "rgba(148,163,184,0.9)", fontSize: 12 }}
                      axisLine={{ stroke: "rgba(255,255,255,0.10)" }}
                      tickLine={{ stroke: "rgba(255,255,255,0.10)" }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      width={44}
                      tick={{ fill: "rgba(148,163,184,0.9)", fontSize: 12 }}
                      axisLine={{ stroke: "rgba(255,255,255,0.10)" }}
                      tickLine={{ stroke: "rgba(255,255,255,0.10)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15, 23, 42, 0.92)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 16,
                        color: "white",
                      }}
                      labelStyle={{ color: "rgba(226,232,240,0.9)" }}
                      labelFormatter={(ts) => new Date(Number(ts)).toLocaleDateString("ru-RU")}
                      formatter={(value, name) => {
                        if (name === "height") return [`${value} см`, "Рост"];
                        if (name === "weight") return [`${value} кг`, "Вес"];
                        return [value as string, name as string];
                      }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="height"
                      dot={{ r: 3 }}
                      stroke="rgba(34,211,238,0.95)"
                      strokeWidth={2.25}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="weight"
                      dot={{ r: 3 }}
                      stroke="rgba(244,114,182,0.95)"
                      strokeWidth={2.25}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ADD MEASUREMENT */}
          <form onSubmit={handleAddMeasurement} className={`${ui.card} ${ui.cardPad} mb-8`}>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h3 className="text-base font-bold">Добавить измерение</h3>
                <p className={`mt-1 text-sm ${ui.muted}`}>
                  Дата + рост + вес сохраняются в базу
                </p>
              </div>
              {savingMeasurement && (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Loader2 className="animate-spin" size={16} /> Сохранение...
                </div>
              )}
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
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

            <button disabled={savingMeasurement} className={ui.primaryBtn}>
              {savingMeasurement && <Loader2 className="animate-spin" size={16} />}
              Сохранить
            </button>
          </form>

          {/* HISTORY */}
          <div className={`${ui.card} ${ui.cardPad}`}>
            <div className="mb-4 flex items-end justify-between gap-3">
              <h3 className="text-base font-bold">История измерений</h3>
              <span className={`text-xs ${ui.muted}`}>
                {childMeasurements.length} записей
              </span>
            </div>

            {loadingMeasurements ? (
              <p className={ui.muted}>Загрузка...</p>
            ) : childMeasurements.length === 0 ? (
              <p className={ui.muted}>Нет данных измерений</p>
            ) : (
              <div className="space-y-3">
                {childMeasurements
                  .slice()
                  .reverse()
                  .map((m) => (
                    <div
  key={m.id}
  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
>
  <span className="text-slate-300">
    {formatRuDate(m.date)}
  </span>

  <span className="font-semibold">
    {m.height} см
  </span>

  <span className="font-semibold">
    {m.weight} кг
  </span>

  <button
    onClick={() => handleDeleteMeasurement(m.id)}
    className="text-red-400 hover:text-red-300 transition"
  >
    <Trash2 size={16} />
  </button>
</div>
                  ))}
              </div>
            )}
          </div>

          <div className={`mt-10 text-center text-xs ${ui.muted}`}>
            © {new Date().getFullYear()} Bala Growth Monitor • API + Postgres + React
          </div>
        </div>
      </div>
    );
  }

  // =============================================================
  // ======================= HOME PAGE ===========================
  // =============================================================
  return (
    <div className={ui.page}>
      <div className={ui.container}>
        <header className="mb-12 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold">
              <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Bala Growth Monitor
              </span>
            </h1>
            <p className={`mt-2 text-sm ${ui.muted}`}>
              Мониторинг физического развития детей • графики роста и веса
            </p>
          </div>

          <button onClick={() => setIsFormOpen(true)} className={ui.primaryBtn}>
            <PlusCircle size={18} />
            Добавить ребёнка
          </button>
        </header>

        {error && <div className={`${ui.danger} mb-6`}>{error}</div>}

        {isFormOpen && (
          <form onSubmit={handleAddChild} className={`${ui.card} ${ui.cardPad} mb-8 max-w-xl`}>
            <div className="mb-4">
              <h3 className="text-base font-bold">Новый профиль</h3>
              <p className={`mt-1 text-sm ${ui.muted}`}>Создай ребёнка и начни добавлять измерения</p>
            </div>

            <input
              autoFocus
              className={ui.input}
              placeholder="Введите имя ребёнка"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              minLength={2}
            />

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button type="submit" disabled={savingChild} className={ui.primaryBtn}>
                {savingChild && <Loader2 className="animate-spin" size={16} />}
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

        {loadingChildren ? (
          <div className="flex items-center gap-2 text-slate-300">
            <Loader2 className="animate-spin" size={16} /> Загрузка детей...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {children.length === 0 ? (
              <div className={`${ui.card} ${ui.cardPad} col-span-full py-16 text-center`}>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
                  <Baby className="text-slate-300" size={30} />
                </div>
                <p className="text-base font-semibold text-white/90">Список детей пуст</p>
                <p className={`mt-2 text-sm ${ui.muted}`}>Начни с создания первого профиля</p>
              </div>
            ) : (
              children.map((child) => (
                <div
                  key={child.id}
                  className={`${ui.card} ${ui.cardPad} group transition hover:border-blue-500/30 hover:bg-white/[0.06]`}
                >
                  <div className="mb-4 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20">
                      <Baby size={22} />
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white/90">
                        {child.name}
                      </h3>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                        {child.gender === "male" ? "Мальчик" : "Девочка"}
                      </p>
                    </div>
                  </div>

                  <div className={`mb-6 flex items-center gap-2 text-sm ${ui.muted}`}>
                    <Calendar size={16} />
                    {formatRuDate(child.birthDate)}
                  </div>

                  <button
                    onClick={() => setSelectedChild(child)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-white/90 transition hover:border-blue-500/30 hover:bg-gradient-to-r hover:from-blue-500 hover:to-purple-600"
                  >
                    Открыть график роста
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        <div className={`mt-12 text-center text-xs ${ui.muted}`}>
          Сделано на React + Tailwind + Express + Prisma
        </div>
      </div>
    </div>
  );
}