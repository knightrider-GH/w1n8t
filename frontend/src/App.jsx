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
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend
} from 'recharts'

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page:     { minHeight:'100vh', background:'#0b1120', color:'#e2e8f0', fontFamily:'Inter, sans-serif', fontSize:14 },
  header:   { display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between',
              padding:'14px 28px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'#0f172a', gap:12 },
  logo:     { display:'flex', alignItems:'center', gap:12 },
  controls: { display:'flex', flexWrap:'wrap', gap:12, alignItems:'center' },
  select:   { background:'#1e293b', border:'1px solid rgba(255,255,255,0.1)', color:'#e2e8f0',
              borderRadius:8, padding:'6px 12px', fontSize:13, cursor:'pointer', outline:'none' },
  tabs:     { display:'flex', background:'#1e293b', borderRadius:8, padding:3, gap:3 },
  tab:      (active) => ({
    padding:'7px 16px', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer', border:'none',
    background: active ? '#0284c7' : 'transparent',
    color:      active ? '#ffffff' : '#94a3b8',
    transition: 'all 0.15s ease',
  }),
  main:     { maxWidth:1100, margin:'0 auto', padding:'28px 20px' },
  grid4:    { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:16, marginBottom:24 },
  card:     { background:'#0f172a', border:'1px solid rgba(255,255,255,0.06)', borderRadius:14, padding:18,
              boxShadow:'0 4px 16px rgba(0,0,0,0.25)' },
  label:    { fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'#64748b' },
  big:      (color='#e2e8f0') => ({ fontSize:26, fontWeight:800, color, margin:'4px 0' }),
  sub:      { fontSize:12, color:'#64748b' },
  chart:    { background:'#0f172a', border:'1px solid rgba(255,255,255,0.06)', borderRadius:14, padding:'20px 18px',
              marginBottom:24, boxShadow:'0 4px 16px rgba(0,0,0,0.25)' },
  tip:      { background:'#0f172a', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, color:'#e2e8f0', padding:'10px 14px' },
  table:    { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th:       { padding:'10px 14px', textAlign:'left', background:'#0f172a', color:'#64748b',
              fontSize:11, fontWeight:700, textTransform:'uppercase', position:'sticky', top:0,
              borderBottom:'1px solid rgba(255,255,255,0.08)' },
  td:       { padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,0.05)' },
}

// Tooltip styling for recharts
const tooltipStyle = { contentStyle: S.tip, cursor:{ stroke:'rgba(255,255,255,0.1)' } }

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

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
// Jan 1 2026 is Thursday (col index 3). 3 blank slots before 1st, 31 days, 1 blank slot after 31st (Sun).
const CALENDAR_CELLS = [
  null, null, null,
  ...Array.from({ length: 31 }, (_, i) => i + 1),
  null
]

function getPrevDate(str) {
  if (!str) return ''
  const d = new Date(str + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
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
  const [openPicker, setOpenPicker] = useState(false)        // toggle small calendar dropdown preview

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

  const currIdx = dates.indexOf(selDate)
  const hasPrev = currIdx > 0
  const hasNext = currIdx < dates.length - 1
  const goPrev = () => hasPrev && setSelDate(dates[currIdx - 1])
  const goNext = () => hasNext && setSelDate(dates[currIdx + 1])

  return (
    <div style={S.page}>

      {/* ── Header ── */}
      <header style={S.header}>
        <div style={S.logo}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #06b6d4, #2563eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(6, 182, 212, 0.3)',
            flexShrink: 0
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
              <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
              <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
            </svg>
          </div>
          <div>
            <div style={{fontSize:18, fontWeight:700, color:'#ffffff', letterSpacing:'-0.02em', lineHeight:1.2}}>
              VoltWise UK
            </div>
            <div style={{fontSize:12, color:'#94a3b8', marginTop:2}}>
              Day-Ahead Wind Procurement · National Grid GB
            </div>
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
            {/* Delivery Date dropdown at left, Prev/Next buttons at top right */}
            <div style={{
              display:'flex',
              alignItems:'center',
              justifyContent:'space-between',
              marginBottom:22,
              position:'relative'
            }}>
              {/* Top-left: Dropdown trigger button */}
              <div style={{display:'flex', alignItems:'center', gap:8, position:'relative'}}>
                <span style={{color:'#94a3b8', fontSize:13, fontWeight:600}}>Delivery Date:</span>
                <button
                  type="button"
                  onClick={() => setOpenPicker(!openPicker)}
                  style={{
                    background: '#1e293b',
                    border: openPicker ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                    color: '#f8fafc',
                    borderRadius: 8,
                    padding: '7px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    boxShadow: openPicker ? '0 0 12px rgba(56, 189, 248, 0.35)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{selDate}</span>
                  <span style={{
                    fontSize: 10,
                    color: '#94a3b8',
                    transform: openPicker ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s ease'
                  }}>
                    ▼
                  </span>
                </button>

                {/* Floating small calendar preview dropdown */}
                {openPicker && (
                  <>
                    {/* Backdrop */}
                    <div
                      onClick={() => setOpenPicker(false)}
                      style={{position:'fixed', inset:0, zIndex:40}}
                    />

                    {/* Small preview card */}
                    <div style={{
                      position:'absolute',
                      top:'calc(100% + 8px)',
                      left: 95,
                      zIndex:50,
                      background:'#0f172a',
                      border:'1px solid rgba(255,255,255,0.12)',
                      borderRadius:14,
                      padding:'14px 16px',
                      width: 320,
                      boxShadow:'0 16px 40px rgba(0,0,0,0.6)',
                    }}>
                      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, paddingBottom:8, borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                        <span style={{fontSize:13, fontWeight:700, color:'#f8fafc'}}>
                          January 2026
                        </span>
                        <span style={{fontSize:11, color:'#64748b'}}>
                          Select date
                        </span>
                      </div>

                      {/* Weekday headers */}
                      <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4, marginBottom:6}}>
                        {DAYS_OF_WEEK.map(w => (
                          <div key={w} style={{textAlign:'center', fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase'}}>
                            {w.slice(0, 2)}
                          </div>
                        ))}
                      </div>

                      {/* Small calendar preview grid */}
                      <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4}}>
                        {CALENDAR_CELLS.map((dayNum, idx) => {
                          if (!dayNum) {
                            return <div key={`empty-${idx}`} style={{opacity:0}} />
                          }
                          const dateStr = `2026-01-${String(dayNum).padStart(2, '0')}`
                          const isSelected = selDate === dateStr
                          const dayMetric = monthData?.daily?.find(x => x.date === dateStr)?.metrics

                          return (
                            <button
                              key={dateStr}
                              type="button"
                              onClick={() => {
                                setSelDate(dateStr)
                                setOpenPicker(false)
                              }}
                              style={{
                                background: isSelected
                                  ? 'linear-gradient(135deg, #0284c7, #0369a1)'
                                  : 'rgba(255,255,255,0.03)',
                                border: isSelected
                                  ? '1px solid #38bdf8'
                                  : '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 6,
                                padding: '4px 2px',
                                cursor: 'pointer',
                                textAlign: 'center',
                                transition: 'all 0.15s ease',
                                boxShadow: isSelected ? '0 0 10px rgba(56, 189, 248, 0.4)' : 'none',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: 36,
                              }}
                              onMouseEnter={e => {
                                if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                              }}
                              onMouseLeave={e => {
                                if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                              }}
                            >
                              <span style={{
                                fontSize: 12,
                                fontWeight: isSelected ? 800 : 600,
                                color: isSelected ? '#ffffff' : '#e2e8f0',
                              }}>
                                {dayNum}
                              </span>
                              {dayMetric && (
                                <span style={{
                                  fontSize: 8,
                                  fontWeight: 600,
                                  color: isSelected
                                    ? '#e0f2fe'
                                    : dayMetric.accuracy >= 80 ? '#4ade80' : '#fb923c',
                                }}>
                                  {dayMetric.accuracy}%
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Top-right: Prev / Next buttons */}
              <div style={{display:'flex', alignItems:'center', gap:6}}>
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={!hasPrev}
                  style={{
                    background: hasPrev ? '#1e293b' : 'transparent',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: hasPrev ? '#e2e8f0' : '#475569',
                    padding: '6px 12px',
                    borderRadius: 6,
                    cursor: hasPrev ? 'pointer' : 'not-allowed',
                    fontSize: 12,
                    fontWeight: 600
                  }}>
                  ← Prev
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!hasNext}
                  style={{
                    background: hasNext ? '#1e293b' : 'transparent',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: hasNext ? '#e2e8f0' : '#475569',
                    padding: '6px 12px',
                    borderRadius: 6,
                    cursor: hasNext ? 'pointer' : 'not-allowed',
                    fontSize: 12,
                    fontWeight: 600
                  }}>
                  Next →
                </button>
              </div>
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
                          <stop offset="10%" stopColor="#a78bfa" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3"/>
                      <XAxis dataKey="time" stroke="#475569" tick={{fontSize:11}}/>
                      <YAxis stroke="#475569" tick={{fontSize:11}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                      <Tooltip {...tooltipStyle}
                        formatter={(v,n) => [`${v.toLocaleString()} MW`, n==='actual'?'Actual':'Forecast']}
                        labelFormatter={l => `Time: ${l} UTC`}/>
                      <Legend formatter={v => v==='actual'?'Actual (FUELHH)':'Day-Ahead Forecast (WINDFOR)'}/>
                      <Area type="monotone" dataKey="actual"   stroke="#22d3ee" fill="url(#gA)" strokeWidth={2.5} name="actual"/>
                      <Area type="monotone" dataKey="forecast" stroke="#a78bfa" fill="url(#gF)" strokeWidth={2}
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
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3"/>
                      <XAxis dataKey="time" stroke="#475569" tick={{fontSize:10}}/>
                      <YAxis stroke="#475569" tick={{fontSize:11}}/>
                      <ReferenceLine y={0} stroke="#475569"/>
                      <Tooltip {...tooltipStyle}
                        formatter={v => [`${v.toLocaleString()} MW`, 'Error (Forecast − Actual)']}
                        labelFormatter={l => `Time: ${l} UTC`}/>
                      <Bar dataKey="error" name="Error">
                        {(dayData?.data || []).map((entry, index) => (
                          <Cell
                            key={`err-${index}`}
                            fill={entry.error >= 0 ? '#f59e0b' : '#34d399'}
                          />
                        ))}
                      </Bar>
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
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={monthData.daily.map(d => ({
                    day:  d.date.slice(8),      // just the day number
                    mae:  d.metrics.mae,
                    bias: d.metrics.bias,
                  }))}
                  margin={{ top: 10, right: 10, left: 0, bottom: 22 }}
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3"/>
                  <XAxis dataKey="day" stroke="#475569" tick={{fontSize:11}}
                    label={{value:'Day of January', position:'insideBottom', offset:-10, fill:'#94a3b8', fontSize:12}}/>
                  <YAxis stroke="#475569" tick={{fontSize:11}} unit=" MW"/>
                  <Tooltip {...tooltipStyle} labelFormatter={d=>`Jan ${d}, 2026`}
                    formatter={(v,n) => [`${v.toLocaleString()} MW`, n==='mae'?'MAE':'Bias']}/>
                  <Legend wrapperStyle={{ paddingTop: 26 }}/>
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
                        onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.04)'}
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
                          style={{background:'rgba(56, 189, 248, 0.1)', border:'1px solid rgba(56, 189, 248, 0.25)', color:'#7dd3fc',
                                  borderRadius:6, padding:'4px 12px', cursor:'pointer', fontSize:12, fontWeight:500}}>
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
    </div>
  )
}
