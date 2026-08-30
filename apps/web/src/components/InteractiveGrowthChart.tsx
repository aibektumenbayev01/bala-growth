import { useMemo, useRef } from "react";
import { Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { LmsReferencePoint } from "../who/cdc-2-20";
import { lmsValue } from "../who/cdc-2-20";

export type GrowthMetric = "height" | "weight";
type Props = { activeMetric: GrowthMetric; ageMonths: number; reference: LmsReferencePoint[]; height: number | null; weight: number | null; onSelect: (metric: GrowthMetric, value: number) => void };
const percentiles = [["P5",-1.644854],["P10",-1.281552],["P25",-.67449],["P50",0],["P75",.67449],["P90",1.281552],["P95",1.644854]] as const;
const margins={top:10,right:46,bottom:4,left:8};

function ChartPanel({metric,active,ageMonths,reference,value,onSelect}:{metric:GrowthMetric;active:boolean;ageMonths:number;reference:LmsReferencePoint[];value:number|null;onSelect:(value:number)=>void}){
 const host=useRef<HTMLDivElement>(null);
 const data=useMemo(()=>reference.map(row=>({ageMonths:row.ageMonths,P5:lmsValue(row[metric],percentiles[0][1]),P10:lmsValue(row[metric],percentiles[1][1]),P25:lmsValue(row[metric],percentiles[2][1]),P50:lmsValue(row[metric],0),P75:lmsValue(row[metric],percentiles[4][1]),P90:lmsValue(row[metric],percentiles[5][1]),P95:lmsValue(row[metric],percentiles[6][1])})),[metric,reference]);
 const all=data.flatMap(row=>[Number(row.P5),Number(row.P95)]),pad=metric==="height"?5:4;
 const domain:[number,number]=[Math.floor(Math.min(...all)-pad),Math.ceil(Math.max(...all)+pad)];
 function pick(event:React.PointerEvent<HTMLDivElement>){if(!active)return;const rect=host.current?.getBoundingClientRect();if(!rect)return;const top=margins.top,bottom=rect.height-margins.bottom-18,y=Math.max(top,Math.min(bottom,event.clientY-rect.top));const raw=domain[0]+((bottom-y)/(bottom-top))*(domain[1]-domain[0]);onSelect(Number((Math.round(raw*10)/10).toFixed(1)));}
 return <div ref={host} onPointerDown={pick} className={`relative h-1/2 touch-none select-none ${active?"cursor-crosshair":"opacity-55"}`} style={{backgroundImage:"repeating-linear-gradient(to right,transparent 0,transparent calc(2.777% - 1px),#dbe2e8 calc(2.777% - 1px),#dbe2e8 2.777%),repeating-linear-gradient(to bottom,transparent 0,transparent 11px,#edf1f4 11px,#edf1f4 12px)"}}>
  <div className="absolute left-1 top-1/2 z-10 -translate-y-1/2 text-[10px] font-bold tracking-[.24em] text-slate-700 [writing-mode:vertical-rl]">{metric==="height"?"STATURE":"WEIGHT"}</div>
  <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={margins}><XAxis dataKey="ageMonths" type="number" domain={[24,240]} ticks={Array.from({length:19},(_,i)=>(i+2)*12)} tickFormatter={v=>String(v/12)} tick={{fontSize:10,fill:"#334155"}} axisLine={{stroke:"#64748b"}} tickLine={false} orientation={metric==="height"?"top":"bottom"}/><YAxis domain={domain} width={48} tick={{fontSize:10,fill:"#334155"}} axisLine={{stroke:"#64748b"}} tickLine={false} unit={metric==="height"?" cm":" kg"}/>{percentiles.map(([key])=><Line key={key} dataKey={key} type="monotone" stroke="#172033" strokeWidth={key==="P50"?2:1} dot={false} isAnimationActive={false}/>)}<ReferenceLine x={ageMonths} stroke="#1673d1" strokeWidth={2} strokeDasharray="6 5"/>{value!==null&&<ReferenceDot x={ageMonths} y={value} r={6} fill="#1673d1" stroke="white" strokeWidth={2}/>}</LineChart></ResponsiveContainer>
  <div className="pointer-events-none absolute right-2 top-3 flex flex-col gap-[7px] text-[9px] font-semibold text-slate-700">{percentiles.slice().reverse().map(([key])=><span key={key}>{key.replace("P","")}</span>)}</div>
  {value!==null&&active&&<div className="pointer-events-none absolute right-14 top-3 rounded-md bg-blue-600 px-2 py-1 text-xs font-bold text-white shadow">{value.toFixed(1)} {metric==="height"?"cm":"kg"}</div>}
 </div>;
}

export default function InteractiveGrowthChart(props:Props){const agePosition=`${Math.max(0,Math.min(100,((props.ageMonths-24)/216)*100))}%`;return <div className="relative h-[600px] min-h-[480px] overflow-hidden border border-slate-300 bg-white" style={{"--age-position":agePosition} as React.CSSProperties}><div className="absolute left-1/2 top-1 z-20 -translate-x-1/2 text-xs font-semibold tracking-wide">AGE (YEARS)</div><ChartPanel metric="height" active={props.activeMetric==="height"} ageMonths={props.ageMonths} reference={props.reference} value={props.height} onSelect={v=>props.onSelect("height",v)}/><div className="border-t-2 border-slate-500"/><ChartPanel metric="weight" active={props.activeMetric==="weight"} ageMonths={props.ageMonths} reference={props.reference} value={props.weight} onSelect={v=>props.onSelect("weight",v)}/><div className="pointer-events-none absolute bottom-0 top-0 border-l-2 border-dashed border-blue-500" style={{left:agePosition}}/><div className="pointer-events-none absolute bottom-0 -translate-x-1/2 rounded-t bg-white px-1 text-sm font-bold text-blue-600" style={{left:agePosition}}>{(props.ageMonths/12).toFixed(1)}</div></div>}
