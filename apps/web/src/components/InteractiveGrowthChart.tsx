import { useMemo, useRef } from "react";
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { LmsReferencePoint } from "../who/cdc-2-20";
import { lmsValue, percentileZ } from "../who/cdc-2-20";

type Metric = "height" | "weight";
type Props = { metric: Metric; ageMonths: number; reference: LmsReferencePoint[]; value: number | null; onChange: (value: number) => void };
const margins = { top: 18, right: 18, bottom: 24, left: 16 };

export default function InteractiveGrowthChart({ metric, ageMonths, reference, value, onChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const data = useMemo(() => reference.map((row) => ({
    ageMonths: row.ageMonths,
    p3: Number(lmsValue(row[metric], percentileZ.p3).toFixed(2)),
    p15: Number(lmsValue(row[metric], percentileZ.p15).toFixed(2)),
    p50: Number(lmsValue(row[metric], percentileZ.p50).toFixed(2)),
    p85: Number(lmsValue(row[metric], percentileZ.p85).toFixed(2)),
    p97: Number(lmsValue(row[metric], percentileZ.p97).toFixed(2)),
  })), [metric, reference]);
  const values = data.flatMap((row) => [row.p3, row.p97]);
  const rawMin = Math.min(...values); const rawMax = Math.max(...values);
  const padding = metric === "height" ? 8 : 5;
  const domain: [number, number] = [Math.floor(rawMin - padding), Math.ceil(rawMax + padding)];
  const xDomain: [number, number] = [reference[0].ageMonths, reference.at(-1)!.ageMonths];

  function select(event: React.PointerEvent<HTMLDivElement>) {
    const rect = hostRef.current?.getBoundingClientRect(); if (!rect) return;
    const plotTop = margins.top; const plotBottom = rect.height - margins.bottom;
    const y = Math.max(plotTop, Math.min(plotBottom, event.clientY - rect.top));
    const ratio = (plotBottom - y) / (plotBottom - plotTop);
    const raw = domain[0] + ratio * (domain[1] - domain[0]);
    onChange(Number((Math.round(raw * (metric === "height" ? 2 : 10)) / (metric === "height" ? 2 : 10)).toFixed(1)));
  }

  const colors = { p3:"#94a3b8", p15:"#67a6b4", p50:"#0891b2", p85:"#67a6b4", p97:"#94a3b8" };
  return <div ref={hostRef} onPointerDown={select} className="relative h-[310px] w-full cursor-crosshair touch-none select-none overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-label={`Select ${metric} on growth chart`}>
    <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={margins}>
      <CartesianGrid stroke="#e2e8f0" strokeDasharray="2 4" />
      <XAxis dataKey="ageMonths" type="number" domain={xDomain} tickFormatter={(v) => `${Math.floor(v/12)}y`} tick={{fontSize:11}} />
      <YAxis domain={domain} width={42} tick={{fontSize:11}} unit={metric === "height" ? "cm" : "kg"} />
      {Object.entries(colors).map(([key,stroke]) => <Line key={key} dataKey={key} type="monotone" stroke={stroke} strokeWidth={key === "p50" ? 2.5 : 1.5} dot={false} isAnimationActive={false} />)}
      <ReferenceLine x={ageMonths} stroke="#0f172a" strokeWidth={2} strokeDasharray="5 4" />
      {value !== null && <ReferenceLine y={value} stroke="#f97316" strokeWidth={2} strokeDasharray="4 3" />}
      {value !== null && <ReferenceDot x={ageMonths} y={value} r={6} fill="#f97316" stroke="#fff" strokeWidth={2} />}
    </LineChart></ResponsiveContainer>
    {value !== null && <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-orange-500 px-2.5 py-1 text-xs font-bold text-white shadow">{value.toFixed(1)} {metric === "height" ? "cm" : "kg"}</div>}
  </div>;
}
