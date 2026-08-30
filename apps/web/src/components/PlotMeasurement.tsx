import { useMemo, useState } from "react";
import type { Child } from "@bala/shared";
import { Loader2, Save } from "lucide-react";
import { getAgeInMonths, getHeightPercentileBand, getHeightZScore, getNearestWhoRow } from "../lib/growth";
import { cdcBoys2to20, cdcGirls2to20, lmsValue, percentileZ } from "../who/cdc-2-20";
import InteractiveGrowthChart from "./InteractiveGrowthChart";

type Props = { child: Child; date: string; maxDate: string; saving: boolean; onDateChange: (value:string) => void; onSave: (input:{date:string;height:number;weight:number}) => Promise<void> };
const parseUtc = (value:string) => new Date(`${value}T00:00:00.000Z`);

export default function PlotMeasurement({ child, date, maxDate, saving, onDateChange, onSave }: Props) {
  const [height,setHeight] = useState<number|null>(null); const [weight,setWeight] = useState<number|null>(null);
  const measureDate = parseUtc(date); const ageMonths = getAgeInMonths(child.birthDate, measureDate);
  const reference = child.gender === "male" ? cdcBoys2to20 : cdcGirls2to20;
  const heightReference = useMemo(() => reference.map((row) => ({ ageMonths: row.ageMonths, p3:lmsValue(row.height,percentileZ.p3), p15:lmsValue(row.height,percentileZ.p15), p50:lmsValue(row.height,0), p85:lmsValue(row.height,percentileZ.p85), p97:lmsValue(row.height,percentileZ.p97) })), [reference]);
  const inRange = ageMonths >= 24 && ageMonths < 240 && measureDate >= child.birthDate && measureDate <= parseUtc(maxDate);
  const analytics = useMemo(() => { if (height === null) return null; const row=getNearestWhoRow(heightReference,ageMonths); return { percentile:getHeightPercentileBand(height,row), z:getHeightZScore(height,row) }; },[ageMonths,height,heightReference]);
  const years=Math.floor(ageMonths/12), months=ageMonths%12;
  function changeDate(next:string){ onDateChange(next); setHeight(null); setWeight(null); }
  async function save(){ if(height===null||weight===null||!inRange)return; await onSave({date,height,weight}); setHeight(null); setWeight(null); }
  return <div className="mt-5 space-y-5">
    <label className="block text-sm font-semibold text-slate-700">Measurement date<input type="date" value={date} min={child.birthDate.toISOString().slice(0,10)} max={maxDate} onChange={(e)=>changeDate(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-cyan-400" /></label>
    <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-900"><span className="font-semibold">Age:</span> {years} years {months} months</div>
    {!inRange ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Interactive CDC plotting is available from age 2 through 19 years 11 months. Choose a valid date in that range.</div> : <>
      <section><div className="mb-3"><h3 className="font-bold text-slate-900">Height-for-age</h3><p className="text-sm text-slate-500">Click vertically to select height at the fixed age line.</p></div><InteractiveGrowthChart metric="height" ageMonths={ageMonths+.5} reference={reference} value={height} onChange={setHeight}/>{height!==null&&<div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><b>Height:</b> {height.toFixed(1)} cm · <b>Age:</b> {years} years {months} months{analytics&&<> · <b>Percentile:</b> {analytics.percentile} · <b>Z-score:</b> {analytics.z?.toFixed(2)??"—"}</>}</div>}</section>
      <section><div className="mb-3"><h3 className="font-bold text-slate-900">Weight-for-age</h3><p className="text-sm text-slate-500">Click vertically to select weight at the same fixed age.</p></div><InteractiveGrowthChart metric="weight" ageMonths={ageMonths+.5} reference={reference} value={weight} onChange={setWeight}/>{weight!==null&&<div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><b>Weight:</b> {weight.toFixed(1)} kg</div>}</section>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><div><span className="text-slate-500">Date</span><div className="font-semibold">{date}</div></div><div><span className="text-slate-500">Age</span><div className="font-semibold">{years}y {months}m</div></div><div><span className="text-slate-500">Height</span><div className="font-semibold">{height?.toFixed(1)??"—"} cm</div></div><div><span className="text-slate-500">Weight</span><div className="font-semibold">{weight?.toFixed(1)??"—"} kg</div></div></div><button type="button" disabled={saving||height===null||weight===null} onClick={()=>void save()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 font-semibold text-white hover:bg-cyan-600 disabled:opacity-50">{saving?<Loader2 size={18} className="animate-spin"/>:<Save size={18}/>}Save measurement</button></div>
    </>}
  </div>;
}
