/**
 * App.jsx — UK Wind Generation Day-Ahead Forecast Dashboard
 *
 * Two views:
 *  1. "Daily View"   — Pick any day in Jan 2026, see Actual vs Forecast chart
 *                      + four error metric cards (MAE, RMSE, Bias, Accuracy)
 *  2. "Monthly View" — Bar chart of daily MAE across all 31 days + audit table
 */

import React, { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend
} from 'recharts'

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page:   { minHeight:'100vh', background:'#0b1120', color:'#e2e8f0', fontFamily:'Inter, sans-serif', fontSize:14 },
  header: { display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between',
            padding:'16px 28px', borderBottom:'1px solid #1e293b', background:'#0f172a', gap:12 },
  logo:   { display:'flex', alignItems:'center', gap:10 },
  badge:  { background:'#0e4f6b', color:'#7dd3fc', border:'1px solid #0284c7',
            borderRadius:99, padding:'2px 10px', fontSize:12, fontWeight:600 },
  controls: { display:'flex', flexWrap:'wrap', gap:10, alignItems:'center' },
  select: { background:'#1e293b', border:'1px solid #334155', color:'#e2e8f0',
            borderRadius:8, padding:'6px 12px', fontSize:14, cursor:'pointer' },
  tabs:   { display:'flex', background:'#1e293b', borderRadius:8, padding:3, gap:3 },
  tab:    (active) => ({
    padding:'6px 14px', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer', border:'none',
    background: active ? '#0ea5e9' : 'transparent',
    color:      active ? '#0f172a' : '#94a3b8',
  }),
  main:   { maxWidth:1100, margin:'0 auto', padding:'24px 20px' },
  grid4:  { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:16, marginBottom:24 },
  card:   { background:'#0f172a', border:'1px solid #1e293b', borderRadius:14, padding:18 },
  label:  { fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'#64748b' },
  big:    (color='#e2e8f0') => ({ fontSize:28, fontWeight:800, color, margin:'4px 0' }),
  sub:    { fontSize:12, color:'#64748b' },
  chart:  { background:'#0f172a', border:'1px solid #1e293b', borderRadius:14, padding:'20px 16px', marginBottom:24 },
  tip:    { background:'#0f172a', border:'1px solid #334155', borderRadius:10, color:'#e2e8f0', padding:'10px 14px' },
  table:  { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th:     { padding:'10px 14px', textAlign:'left', background:'#0f172a', color:'#64748b',
            fontSize:11, fontWeight:700, textTransform:'uppercase', position:'sticky', top:0 },
  td:     { padding:'9px 14px', borderBottom:'1px solid #1e293b' },
}

// Tooltip styling for recharts
const tooltipStyle = { contentStyle: S.tip, cursor:{ stroke:'#334155' } }

// ─── Metric card component ─────────────────────────────────────────────────────
function MetricCard({ label, value, unit, color, note }) {
  return (
    <div style={S.card}>
      <div style={S.label}>{label}</div>
      <div style={S.big(color)}>{value} <span style={{fontSize:14, fontWeight:400, color:'#64748b'}}>{unit}</span></div>
      <div style={S.sub}>{note}</div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,        setTab]        = useState('daily')      // 'daily' | 'monthly'
  const [dates,      setDates]      = useState([])           // all Jan 2026 dates
  const [selDate,    setSelDate]    = useState('2026-01-01') // selected delivery date
  const [cutoff,     setCutoff]     = useState(12)           // D-1 gate closure hour
  const [dayData,    setDayData]    = useState(null)         // {data, metrics}
  const [monthData,  setMonthData]  = useState(null)         // {overall, daily}
  const [loading,    setLoading]    = useState(true)

  // Load available dates once
  useEffect(() => {
    fetch('/api/dates')
      .then(r => r.json())
      .then(r => { setDates(r.dates); setSelDate(r.dates[0]) })
  }, [])

  // Load daily data whenever date or cutoff changes
  useEffect(() => {
    if (!selDate) return
    setLoading(true)
    fetch(`/api/day?date=${selDate}&cutoff_hour=${cutoff}`)
      .then(r => r.json())
      .then(r => { setDayData(r); setLoading(false) })
  }, [selDate, cutoff])

  // Load monthly data whenever cutoff changes
  useEffect(() => {
    fetch(`/api/month?cutoff_hour=${cutoff}`)
      .then(r => r.json())
      .then(setMonthData)
  }, [cutoff])

  const m = dayData?.metrics   // shorthand for daily metrics
  const mo = monthData?.overall // shorthand for monthly metrics

  return (
    <div style={S.page}>

      {/* ── Header ── */}
      <header style={S.header}>
        <div style={S.logo}>
          <span style={{fontSize:22}}>💨</span>
          <div>
            <strong style={{fontSize:17}}>VoltWise UK</strong>{' '}
            <span style={S.badge}>Day-Ahead Wind Procurement</span>
            <div style={{fontSize:11, color:'#64748b'}}>Elexon BMRS · January 2026 · National GB Wind</div>
          </div>
        </div>

        <div style={S.controls}>
          {/* Tab switcher */}
          <div style={S.tabs}>
            <button style={S.tab(tab==='daily')}   onClick={() => setTab('daily')}>Daily View</button>
            <button style={S.tab(tab==='monthly')} onClick={() => setTab('monthly')}>Monthly Evaluation</button>
          </div>

          {/* D-1 gate closure selector */}
          <label style={{color:'#94a3b8', fontSize:12}}>
            D-1 Gate Closure:&nbsp;
            <select style={S.select} value={cutoff} onChange={e => setCutoff(+e.target.value)}>
              <option value={11}>11:00 UTC (EPEX)</option>
              <option value={12}>12:00 UTC (NordPool)</option>
              <option value={23}>23:00 UTC (End of D-1)</option>
            </select>
          </label>
        </div>
      </header>

      {/* ── Main content ── */}
      <main style={S.main}>

        {/* ══════════ DAILY VIEW ══════════ */}
        {tab === 'daily' && (
          <>
            {/* Date picker + context */}
            <div style={{display:'flex', flexWrap:'wrap', gap:12, alignItems:'center', marginBottom:20}}>
              <label style={{color:'#94a3b8', fontSize:13}}>
                📅 Delivery Date:&nbsp;
                <select style={S.select} value={selDate} onChange={e => setSelDate(e.target.value)}>
                  {dates.map(d => <option key={d}>{d}</option>)}
                </select>
              </label>
              <span style={{color:'#475569', fontSize:12}}>
                Showing the latest forecast locked before <strong style={{color:'#7dd3fc'}}>{cutoff}:00 UTC on {selDate.slice(0,7)}-{String(+selDate.slice(8)-1).padStart(2,'0')}</strong> (D-1 Gate Closure)
              </span>
            </div>

            {/* 4 Metric cards */}
            {loading ? <p style={{color:'#64748b'}}>Loading…</p> : (
              <>
                <div style={S.grid4}>
                  <MetricCard
                    label="Mean Absolute Error (MAE)"
                    value={m?.mae?.toLocaleString()}  unit="MW"  color="#38bdf8"
                    note="Average MW gap per half-hour period — your thermal buffer need" />
                  <MetricCard
                    label="Root Mean Square Error (RMSE)"
                    value={m?.rmse?.toLocaleString()} unit="MW"  color="#a78bfa"
                    note="Penalises large peak errors — measure of volatility risk" />
                  <MetricCard
                    label="Forecast Bias"
                    value={(m?.bias > 0 ? '+' : '') + m?.bias?.toLocaleString()} unit="MW"
                    color={m?.bias > 0 ? '#fb923c' : '#34d399'}
                    note={m?.bias > 0 ? 'Over-forecast → real-time generation deficit risk' : 'Under-forecast → excess wind, missed savings'} />
                  <MetricCard
                    label="Day Forecast Accuracy"
                    value={m?.accuracy} unit="%"  color="#4ade80"
                    note={`MAPE: ${m?.mape}% · Avg actual: ${m?.avgActual?.toLocaleString()} MW`} />
                </div>

                {/* Main chart: Actual vs Forecast */}
                <div style={S.chart}>
                  <h3 style={{margin:'0 0 4px', fontWeight:700}}>
                    Actual Wind vs Day-Ahead Forecast — {selDate}
                  </h3>
                  <p style={{color:'#64748b', fontSize:12, margin:'0 0 16px'}}>
                    48 settlement periods (30-min) · Source: Elexon FUELHH (actual) & WINDFOR (forecast)
                  </p>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={dayData?.data || []}>
                      <defs>
                        <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="10%" stopColor="#22d3ee" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="gF" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="10%" stopColor="#f59e0b" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3"/>
                      <XAxis dataKey="time" stroke="#475569" tick={{fontSize:11}}/>
                      <YAxis stroke="#475569" tick={{fontSize:11}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                      <Tooltip {...tooltipStyle}
                        formatter={(v,n) => [`${v.toLocaleString()} MW`, n==='actual'?'Actual':'Forecast']}
                        labelFormatter={l => `Time: ${l} UTC`}/>
                      <Legend formatter={v => v==='actual'?'Actual (FUELHH)':'Day-Ahead Forecast (WINDFOR)'}/>
                      <Area type="monotone" dataKey="actual"   stroke="#22d3ee" fill="url(#gA)" strokeWidth={2.5} name="actual"/>
                      <Area type="monotone" dataKey="forecast" stroke="#f59e0b" fill="url(#gF)" strokeWidth={2}
                            strokeDasharray="5 3" name="forecast"/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Secondary chart: Error per period */}
                <div style={S.chart}>
                  <h3 style={{margin:'0 0 4px', fontWeight:700}}>Forecast Error by Settlement Period (MW)</h3>
                  <p style={{color:'#64748b', fontSize:12, margin:'0 0 16px'}}>
                    Orange bar = over-forecast (you need more thermal). Green bar = under-forecast (excess wind).
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dayData?.data || []}>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3"/>
                      <XAxis dataKey="time" stroke="#475569" tick={{fontSize:10}}/>
                      <YAxis stroke="#475569" tick={{fontSize:11}}/>
                      <ReferenceLine y={0} stroke="#475569"/>
                      <Tooltip {...tooltipStyle}
                        formatter={v => [`${v.toLocaleString()} MW`, 'Error (Forecast − Actual)']}
                        labelFormatter={l => `Time: ${l} UTC`}/>
                      <Bar dataKey="error" name="Error"
                           fill="#f59e0b"
                           shape={props => {
                             const {x,y,width,height,value} = props
                             return <rect x={x} y={y} width={width} height={height}
                                          fill={value>=0?'#f59e0b':'#34d399'} rx={2}/>
                           }}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </>
        )}

        {/* ══════════ MONTHLY VIEW ══════════ */}
        {tab === 'monthly' && monthData && (
          <>
            {/* Monthly headline cards */}
            <div style={S.grid4}>
              <MetricCard label="January MAE"      value={mo.mae?.toLocaleString()}  unit="MW" color="#38bdf8"
                          note={`${mo.count} settlement periods evaluated`}/>
              <MetricCard label="January RMSE"     value={mo.rmse?.toLocaleString()} unit="MW" color="#a78bfa"
                          note="Higher than MAE = volatile forecast days present"/>
              <MetricCard label="January Bias"     value={`+${mo.bias?.toLocaleString()}`} unit="MW" color="#fb923c"
                          note="Systematic over-forecast — persistent thermal deficit risk"/>
              <MetricCard label="Monthly Accuracy" value={mo.accuracy} unit="%" color="#4ade80"
                          note={`MAPE ${mo.mape}% · Avg wind ${mo.avgActual?.toLocaleString()} MW`}/>
            </div>

            {/* Daily MAE bar chart */}
            <div style={S.chart}>
              <h3 style={{margin:'0 0 4px', fontWeight:700}}>Daily MAE & Bias — January 2026</h3>
              <p style={{color:'#64748b', fontSize:12, margin:'0 0 16px'}}>
                High MAE days = stormy or rapidly changing wind conditions
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthData.daily.map(d => ({
                  day:  d.date.slice(8),      // just the day number
                  mae:  d.metrics.mae,
                  bias: d.metrics.bias,
                }))}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3"/>
                  <XAxis dataKey="day" stroke="#475569" tick={{fontSize:11}} label={{value:'Day of January', position:'insideBottom', offset:-2, fill:'#64748b', fontSize:11}}/>
                  <YAxis stroke="#475569" tick={{fontSize:11}} unit=" MW"/>
                  <Tooltip {...tooltipStyle} labelFormatter={d=>`Jan ${d}, 2026`}
                    formatter={(v,n) => [`${v.toLocaleString()} MW`, n==='mae'?'MAE':'Bias']}/>
                  <Legend/>
                  <Bar dataKey="mae"  name="mae"  fill="#38bdf8" radius={[4,4,0,0]}/>
                  <Bar dataKey="bias" name="bias" fill="#f59e0b" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Full audit table */}
            <div style={{...S.chart, maxHeight:400, overflowY:'auto'}}>
              <h3 style={{margin:'0 0 16px', fontWeight:700}}>Full January 2026 Error Audit Table</h3>
              <table style={S.table}>
                <thead>
                  <tr>
                    {['Date','Avg Actual (MW)','Avg Forecast (MW)','MAE (MW)','RMSE (MW)','Bias (MW)','Accuracy %',''].map(h =>
                      <th key={h} style={S.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {monthData.daily.map(d => (
                    <tr key={d.date} style={{cursor:'pointer'}}
                        onMouseEnter={e=>e.currentTarget.style.background='#1e293b'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{...S.td, fontWeight:600}}>{d.date}</td>
                      <td style={S.td}>{d.metrics.avgActual?.toLocaleString()}</td>
                      <td style={S.td}>{d.metrics.avgForecast?.toLocaleString()}</td>
                      <td style={{...S.td, color:'#38bdf8', fontWeight:600}}>{d.metrics.mae?.toLocaleString()}</td>
                      <td style={{...S.td, color:'#a78bfa'}}>{d.metrics.rmse?.toLocaleString()}</td>
                      <td style={{...S.td, color: d.metrics.bias>0?'#fb923c':'#34d399', fontWeight:600}}>
                        {d.metrics.bias>0?'+':''}{d.metrics.bias?.toLocaleString()}
                      </td>
                      <td style={{...S.td, color:'#4ade80'}}>{d.metrics.accuracy}%</td>
                      <td style={S.td}>
                        <button onClick={()=>{setTab('daily');setSelDate(d.date)}}
                          style={{background:'transparent', border:'1px solid #334155', color:'#7dd3fc',
                                  borderRadius:6, padding:'3px 10px', cursor:'pointer', fontSize:12}}>
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer style={{borderTop:'1px solid #1e293b', textAlign:'center', padding:'14px', color:'#475569', fontSize:12}}>
        Data: Elexon BMRS (FUELHH & WINDFOR) · January 2026 · Built with React + Python (FastAPI)
      </footer>
    </div>
  )
}
