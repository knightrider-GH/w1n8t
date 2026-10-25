/**
 * App.jsx — UK Wind Generation Day-Ahead Forecast & Procurement Dashboard
 * Evaluates Elexon WINDFOR forecasts against FUELHH actuals for January 2026.
 */

import React, { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend
} from 'recharts'

const API_BASE = import.meta.env.VITE_API_URL || ''

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page:     { minHeight:'100vh', background:'#0b1120', color:'#e2e8f0', fontFamily:'Inter, sans-serif', fontSize:14 },
  hero:     { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
              position:'relative', padding:'32px 20px', backgroundAttachment:'fixed',
              backgroundPosition:'center', backgroundSize:'cover', backgroundRepeat:'no-repeat',
              backgroundImage:'linear-gradient(180deg, rgba(11,17,32,0.12) 0%, rgba(11,17,32,0.38) 60%, #0b1120 100%), url("/hero-wind.webp")' },
  heroCard: { backdropFilter:'blur(3px)', WebkitBackdropFilter:'blur(3px)', background:'rgba(11, 17, 32, 0.12)',
              border:'1px solid rgba(255,255,255,0.18)', borderRadius:16, padding:'36px 40px',
              maxWidth:780, width:'100%', textAlign:'center', boxShadow:'0 8px 32px rgba(0,0,0,0.25)' },
  heroPill: { display:'inline-block', background:'rgba(15, 23, 42, 0.35)', backdropFilter:'blur(4px)',
              border:'1px solid rgba(56, 189, 248, 0.35)', color:'#38bdf8', padding:'6px 16px',
              borderRadius:9999, fontSize:11, fontWeight:700, letterSpacing:'0.08em',
              textTransform:'uppercase', marginBottom:20, textShadow:'0 1px 4px rgba(0,0,0,0.6)' },
  scrollIndicator: {
    position:'absolute', bottom:24, left:'50%', transform:'translateX(-50%)',
    display:'flex', flexDirection:'column', alignItems:'center', gap:6,
    color:'#94a3b8', fontSize:12, fontWeight:500, letterSpacing:'0.04em',
    cursor:'pointer', animation:'floatBounce 2.2s ease-in-out infinite', userSelect:'none'
  },
  header:   { display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between',
              padding:'14px 28px', borderBottom:'1px solid rgba(255,255,255,0.08)',
              background:'rgba(15, 23, 42, 0.85)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
              position:'sticky', top:0, zIndex:50, gap:12 },
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
  grid4:    { display:'grid', gridTemplateColumns:'repeat(4, minmax(0, 1fr))', gap:16, marginBottom:18 },
  card:     { background:'#0f172a', border:'1px solid rgba(255,255,255,0.06)', borderRadius:14, padding:18,
              boxShadow:'0 4px 16px rgba(0,0,0,0.25)' },
  label:    { fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'#64748b' },
  big:      (color='#e2e8f0') => ({ fontSize:26, fontWeight:800, color, margin:'4px 0' }),
  sub:      { fontSize:12, color:'#64748b' },
  chart:    { background:'#0f172a', border:'1px solid rgba(255,255,255,0.06)', borderRadius:14, padding:'20px 18px',
              marginBottom:24, boxShadow:'0 4px 16px rgba(0,0,0,0.25)' },
  tip:      { background:'#0f172a', border:'1px solid rgba(255,255,255,0.15)', borderRadius:10, color:'#f8fafc', padding:'10px 14px' },
  table:    { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th:       { padding:'10px 14px', textAlign:'left', background:'#0f172a', color:'#64748b',
              fontSize:11, fontWeight:700, textTransform:'uppercase', position:'sticky', top:0,
              borderBottom:'1px solid rgba(255,255,255,0.08)' },
  td:       { padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,0.05)' },
}

// Tooltip styling for recharts
const tooltipStyle = {
  contentStyle: {
    ...S.tip,
    backgroundColor: '#0f172a',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    padding: '10px 14px',
    color: '#f8fafc',
  },
  itemStyle: {
    color: '#f8fafc',
    fontSize: 13,
    paddingTop: 2,
    paddingBottom: 2,
  },
  labelStyle: {
    color: '#94a3b8',
    fontWeight: 600,
    fontSize: 12,
    marginBottom: 6,
  },
  cursor: { stroke: 'rgba(255,255,255,0.15)', fill: 'rgba(255,255,255,0.04)' }
}

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
const CALENDAR_CELLS = [
  null, null, null,
  ...Array.from({ length: 31 }, (_, i) => i + 1),
  null
]

const JAN_2026_DATES = Array.from({ length: 31 }, (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`)

export default function App() {
  const [tab,        setTab]        = useState('daily')      // 'daily' | 'monthly'
  const [dates,      setDates]      = useState(JAN_2026_DATES) // all Jan 2026 dates (preloaded)
  const [selDate,    setSelDate]    = useState('2026-01-01') // selected delivery date
  const [cutoff,     setCutoff]     = useState(12)           // D-1 gate closure hour
  const [dayData,    setDayData]    = useState(null)         // {data, metrics, procurementSummary}
  const [monthData,  setMonthData]  = useState(null)         // {overall, sensitivity, diurnal, riskSummary, daily}
  const [loading,    setLoading]    = useState(true)
  const [openPicker, setOpenPicker] = useState(false)        // small calendar dropdown

  // Load available dates once
  useEffect(() => {
    fetch(`${API_BASE}/api/dates`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(r => { if (r.dates && r.dates.length > 0) setDates(r.dates) })
      .catch(console.error)
  }, [])

  // Load daily data whenever date or cutoff changes
  useEffect(() => {
    if (!selDate) return
    setLoading(true)
    fetch(`${API_BASE}/api/day?date=${selDate}&cutoff_hour=${cutoff}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(r => { setDayData(r); setLoading(false) })
      .catch(err => { console.error('Error fetching day data:', err); setLoading(false) })
  }, [selDate, cutoff])

  // Load monthly data whenever cutoff changes
  useEffect(() => {
    fetch(`${API_BASE}/api/month?cutoff_hour=${cutoff}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setMonthData)
      .catch(err => console.error('Error fetching month data:', err))
  }, [cutoff])

  const m = dayData?.metrics
  const mo = monthData?.overall
  const risk = monthData?.riskSummary
  const pSum = dayData?.procurementSummary

  const currIdx = dates.indexOf(selDate)
  const hasPrev = currIdx > 0
  const hasNext = currIdx < dates.length - 1
  const goPrev = () => hasPrev && setSelDate(dates[currIdx - 1])
  const goNext = () => hasNext && setSelDate(dates[currIdx + 1])

  return (
    <div style={S.page}>

      {/* ── 1. Parallax Hero Section ── */}
      <section id="hero-top" style={S.hero}>
        <div style={S.heroCard}>
          <div style={S.heroPill}>
            ELEXON BMRS · UK DAY-AHEAD MARKET (JAN 2026)
          </div>
          <h1 style={{fontSize:'clamp(26px, 3.8vw, 40px)', fontWeight:800, color:'#ffffff', letterSpacing:'-0.02em', lineHeight:1.2, marginBottom:16, textShadow:'0 2px 12px rgba(0, 0, 0, 0.85)'}}>
            VoltWise UK — Wind Forecast &amp; Thermal Hedge Intelligence
          </h1>
          <p style={{fontSize:'clamp(14px, 1.8vw, 15px)', color:'#cbd5e1', lineHeight:1.6, maxWidth:640, margin:'0 auto', textShadow:'0 2px 12px rgba(0, 0, 0, 0.85)'}}>
            Quantifying day-ahead wind uncertainty (WINDFOR vs FUELHH) to size optimal thermal power procurement before EPEX (11:00 UTC) and NordPool (12:00 UTC) gate closures.
          </p>
        </div>

        {/* Subtle Floating Scroll Indicator */}
        <div
          style={S.scrollIndicator}
          onClick={() => document.getElementById('dashboard-main')?.scrollIntoView({ behavior: 'smooth' })}
          title="Scroll to explore terminal"
        >
          <span style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>Scroll to explore terminal</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.6))' }}>
            <path d="M7 10l5 5 5-5" />
          </svg>
        </div>
      </section>

      {/* ── 2. Sticky Header ── */}
      <header style={S.header}>
        <div
          style={{ ...S.logo, cursor: 'pointer' }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          title="Back to Hero Overview"
        >
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, #06b6d4, #2563eb)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(6, 182, 212, 0.3)', flexShrink: 0
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
              Day-Ahead Wind Procurement · National Grid GB (Jan 2026)
            </div>
          </div>
        </div>

        <div style={S.controls}>
          <div style={S.tabs}>
            <button style={S.tab(tab==='daily')}   onClick={() => setTab('daily')}>Daily View</button>
            <button style={S.tab(tab==='monthly')} onClick={() => setTab('monthly')}>Monthly Evaluation</button>
          </div>

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

      {/* ── 3. Main Dashboard ── */}
      <main id="dashboard-main" style={S.main}>

        {/* ══════════ DAILY VIEW ══════════ */}
        {tab === 'daily' && (
          <>
            {/* Delivery Date selector & Prev/Next buttons */}
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, position:'relative'}}>
              <div style={{display:'flex', alignItems:'center', gap:8, position:'relative'}}>
                <span style={{color:'#94a3b8', fontSize:13, fontWeight:600}}>Delivery Date:</span>
                <button
                  type="button"
                  onClick={() => setOpenPicker(!openPicker)}
                  style={{
                    background: '#1e293b',
                    border: openPicker ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                    color: '#f8fafc', borderRadius: 8, padding: '7px 14px', fontSize: 13,
                    fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    boxShadow: openPicker ? '0 0 12px rgba(56, 189, 248, 0.35)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{selDate}</span>
                  <span style={{fontSize: 10, color: '#94a3b8', transform: openPicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease'}}>▼</span>
                </button>

                {/* Floating calendar preview dropdown */}
                {openPicker && (
                  <>
                    <div onClick={() => setOpenPicker(false)} style={{position:'fixed', inset:0, zIndex:40}} />
                    <div style={{
                      position:'absolute', top:'calc(100% + 8px)', left: 95, zIndex:50,
                      background:'#0f172a', border:'1px solid rgba(255,255,255,0.12)',
                      borderRadius:14, padding:'14px 16px', width: 320,
                      boxShadow:'0 16px 40px rgba(0,0,0,0.6)',
                    }}>
                      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, paddingBottom:8, borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                        <span style={{fontSize:13, fontWeight:700, color:'#f8fafc'}}>January 2026</span>
                        <span style={{fontSize:11, color:'#64748b'}}>Select delivery day</span>
                      </div>
                      <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4, marginBottom:6}}>
                        {DAYS_OF_WEEK.map(w => (
                          <div key={w} style={{textAlign:'center', fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase'}}>
                            {w.slice(0, 2)}
                          </div>
                        ))}
                      </div>
                      <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4}}>
                        {CALENDAR_CELLS.map((dayNum, idx) => {
                          if (!dayNum) return <div key={`empty-${idx}`} style={{opacity:0}} />
                          const dateStr = `2026-01-${String(dayNum).padStart(2, '0')}`
                          const isSelected = selDate === dateStr
                          const dayMetric = monthData?.daily?.find(x => x.date === dateStr)?.metrics

                          return (
                            <button
                              key={dateStr}
                              type="button"
                              onClick={() => { setSelDate(dateStr); setOpenPicker(false) }}
                              style={{
                                background: isSelected ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'rgba(255,255,255,0.03)',
                                border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 6, padding: '4px 2px', cursor: 'pointer', textAlign: 'center',
                                transition: 'all 0.15s ease', minHeight: 36, display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                boxShadow: isSelected ? '0 0 10px rgba(56, 189, 248, 0.4)' : 'none',
                              }}
                            >
                              <span style={{fontSize: 12, fontWeight: isSelected ? 800 : 600, color: isSelected ? '#ffffff' : '#e2e8f0'}}>
                                {dayNum}
                              </span>
                              {dayMetric && (
                                <span style={{
                                  fontSize: 8, fontWeight: 600,
                                  color: isSelected ? '#e0f2fe' : dayMetric.accuracy >= 80 ? '#4ade80' : '#fb923c'
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

              <div style={{display:'flex', alignItems:'center', gap:6}}>
                <button type="button" onClick={goPrev} disabled={!hasPrev}
                  style={{
                    background: hasPrev ? '#1e293b' : 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                    color: hasPrev ? '#e2e8f0' : '#475569', padding: '6px 12px', borderRadius: 6,
                    cursor: hasPrev ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 600
                  }}>
                  ← Prev
                </button>
                <button type="button" onClick={goNext} disabled={!hasNext}
                  style={{
                    background: hasNext ? '#1e293b' : 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                    color: hasNext ? '#e2e8f0' : '#475569', padding: '6px 12px', borderRadius: 6,
                    cursor: hasNext ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 600
                  }}>
                  Next →
                </button>
              </div>
            </div>

            {loading ? <p style={{color:'#64748b'}}>Loading forecast data…</p> : (
              <>
                {/* 4 Metric cards */}
                <div style={S.grid4} className="grid-4-cols">
                  <MetricCard
                    label="Mean Absolute Error (MAE)"
                    value={m?.mae?.toLocaleString()} unit="MW" color="#38bdf8"
                    note="Average half-hour gap — required thermal buffer" />
                  <MetricCard
                    label="Root Mean Square Error (RMSE)"
                    value={m?.rmse?.toLocaleString()} unit="MW" color="#a78bfa"
                    note="Penalises large peak discrepancies (volatility risk)" />
                  <MetricCard
                    label="Forecast Bias"
                    value={(m?.bias > 0 ? '+' : '') + m?.bias?.toLocaleString()} unit="MW"
                    color={m?.bias > 0 ? '#fb923c' : '#34d399'}
                    note={m?.bias > 0 ? 'Over-forecast → thermal deficit hedge required' : 'Under-forecast → excess wind available'} />
                  <MetricCard
                    label="Day Forecast Accuracy"
                    value={m?.accuracy} unit="%" color="#4ade80"
                    note={`MAPE: ${m?.mape}% · Avg actual: ${m?.avgActual?.toLocaleString()} MW`} />
                </div>

                {/* Actionable Procurement Decision Banner */}
                {pSum && (
                  <div style={{
                    display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between',
                    background:'linear-gradient(90deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.85))',
                    border:'1px solid rgba(56, 189, 248, 0.25)', borderRadius:10,
                    padding:'12px 18px', marginBottom:20, gap:14, boxShadow:'0 4px 14px rgba(0,0,0,0.2)'
                  }}>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      <span style={{fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase'}}>Expected Wind:</span>
                      <span style={{fontSize:14, fontWeight:700, color:'#38bdf8'}}>{pSum.expectedWindMWh?.toLocaleString()} MWh</span>
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      <span style={{fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase'}}>Recommended Thermal Hedge:</span>
                      <span style={{fontSize:14, fontWeight:700, color:'#fb923c'}}>
                        {pSum.recommendedThermalBufferMWh?.toLocaleString()} MWh
                        <span style={{fontSize:11, fontWeight:400, color:'#94a3b8', marginLeft:5}}>(~{pSum.p90BufferMW?.toLocaleString()} MW P90 hedge)</span>
                      </span>
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      <span style={{fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase'}}>Peak Deficit Window:</span>
                      <span style={{fontSize:14, fontWeight:700, color:'#f87171'}}>{pSum.peakDeficitPeriod}</span>
                    </div>
                  </div>
                )}

                {/* Main chart: Actual vs Forecast + Safe Wind Baseline (P90 Hedged) */}
                <div style={S.chart}>
                  <div style={{display:'flex', flexWrap:'wrap', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12}}>
                    <div>
                      <h3 style={{margin:'0 0 4px', fontWeight:700}}>
                        Actual Wind vs Day-Ahead Forecast — {selDate}
                      </h3>
                      <p style={{color:'#64748b', fontSize:12, margin:0}}>
                        48 settlement periods (30-min aligned) · Elexon FUELHH (actual) vs WINDFOR (D-1 cutoff)
                      </p>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={dayData?.data || []}>
                      <defs>
                        <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="10%" stopColor="#22d3ee" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="gF" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="10%" stopColor="#a78bfa" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="10%" stopColor="#f59e0b" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false}/>
                      <XAxis dataKey="time" stroke="#475569" tick={{fontSize:10}} axisLine={false} tickLine={false} interval={5}/>
                      <YAxis stroke="#475569" tick={{fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(v, n) => [
                          `${v.toLocaleString()} MW`,
                          n === 'actual' ? 'Actual Wind (FUELHH)' :
                          n === 'forecast' ? 'Day-Ahead Forecast (WINDFOR)' :
                          'Safe Wind Baseline (P90 Hedged)'
                        ]}
                        labelFormatter={l => `Settlement Time: ${l} UTC`}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: 10 }}
                        formatter={v =>
                          v === 'actual' ? 'Actual Wind (FUELHH)' :
                          v === 'forecast' ? 'Day-Ahead Forecast (WINDFOR)' :
                          'Safe Wind Baseline (P90 Hedged)'
                        }
                      />
                      <Area type="monotone" dataKey="actual" stroke="#22d3ee" fill="url(#gA)" strokeWidth={2.4} name="actual"/>
                      <Area type="monotone" dataKey="forecast" stroke="#a78bfa" fill="url(#gF)" strokeWidth={2} strokeDasharray="5 3" name="forecast"/>
                      <Area type="monotone" dataKey="safeBaseline" stroke="#f59e0b" fill="url(#gS)" strokeWidth={1.8} strokeDasharray="3 3" name="safeBaseline"/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Secondary chart: Forecast Error by Settlement Period */}
                <div style={S.chart}>
                  <h3 style={{margin:'0 0 4px', fontWeight:700}}>Forecast Error by Settlement Period (MW)</h3>
                  <p style={{color:'#64748b', fontSize:12, margin:'0 0 16px', display:'flex', gap:14}}>
                    <span><span style={{color:'#f59e0b'}}>●</span> Over-forecast (Thermal Deficit)</span>
                    <span><span style={{color:'#10b981'}}>●</span> Under-forecast (Excess Wind)</span>
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dayData?.data || []} barCategoryGap="28%">
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false}/>
                      <XAxis dataKey="time" stroke="#475569" tick={{fontSize:10}} axisLine={false} tickLine={false} interval={5}/>
                      <YAxis stroke="#475569" tick={{fontSize:11}} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(1)}k`}/>
                      <ReferenceLine y={0} stroke="#475569"/>
                      <Tooltip
                        {...tooltipStyle}
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        formatter={v => [`${v > 0 ? '+' : ''}${v.toLocaleString()} MW (${v >= 0 ? 'Over-forecast' : 'Under-forecast'})`, 'Forecast Variance (Forecast − Actual)']}
                        labelFormatter={l => `Settlement Time: ${l} UTC`}
                      />
                      <Bar dataKey="error" name="Forecast Variance" radius={[4, 4, 0, 0]} fillOpacity={0.85}>
                        {(dayData?.data || []).map((entry, index) => (
                          <Cell key={`err-${index}`} fill={entry.error >= 0 ? '#f59e0b' : '#10b981'} fillOpacity={0.85}/>
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </>
        )}

        {/* ══════════ MONTHLY EVALUATION ══════════ */}
        {tab === 'monthly' && monthData && (
          <>
            {/* Monthly headline KPI cards */}
            <div style={S.grid4} className="grid-4-cols">
              <MetricCard label="January MAE" value={mo.mae?.toLocaleString()} unit="MW" color="#38bdf8"
                          note={`${mo.count} settlement periods evaluated`} />
              <MetricCard label="January RMSE" value={mo.rmse?.toLocaleString()} unit="MW" color="#a78bfa"
                          note="Volatile tail-error penalty across month" />
              <MetricCard label="January Bias" value={`+${mo.bias?.toLocaleString()}`} unit="MW" color="#fb923c"
                          note="Persistent over-forecast (thermal deficit risk)" />
              <MetricCard label="Monthly Accuracy" value={mo.accuracy} unit="%" color="#4ade80"
                          note={`MAPE: ${mo.mape}% · Avg wind: ${mo.avgActual?.toLocaleString()} MW`} />
            </div>

            {/* Error Distribution & Risk Breakdown */}
            {risk && (
              <div style={{...S.grid4, marginBottom:22}} className="grid-4-cols">
                <div style={{...S.card, background:'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(15, 23, 42, 0.95))', borderColor:'rgba(245, 158, 11, 0.25)'}}>
                  <div style={S.label}>Over-Forecast Risk</div>
                  <div style={S.big('#fb923c')}>{risk.pctOver}%</div>
                  <div style={S.sub}>Settlement periods requiring thermal reserve dispatch</div>
                </div>
                <div style={{...S.card, background:'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(15, 23, 42, 0.95))', borderColor:'rgba(16, 185, 129, 0.25)'}}>
                  <div style={S.label}>Under-Forecast Periods</div>
                  <div style={S.big('#34d399')}>{risk.pctUnder}%</div>
                  <div style={S.sub}>Periods with surplus wind (curtailment/imbalance credit)</div>
                </div>
                <div style={{...S.card, background:'linear-gradient(135deg, rgba(167, 139, 250, 0.08), rgba(15, 23, 42, 0.95))', borderColor:'rgba(167, 139, 250, 0.25)'}}>
                  <div style={S.label}>P90 Shortfall Buffer</div>
                  <div style={S.big('#a78bfa')}>{risk.p90Shortfall?.toLocaleString()} <span style={{fontSize:14, fontWeight:400, color:'#94a3b8'}}>MW</span></div>
                  <div style={S.sub}>90% confidence thermal headroom for D-1 hedge</div>
                </div>
                <div style={{...S.card, background:'linear-gradient(135deg, rgba(248, 113, 113, 0.08), rgba(15, 23, 42, 0.95))', borderColor:'rgba(248, 113, 113, 0.25)'}}>
                  <div style={S.label}>P95 Tail Shortfall</div>
                  <div style={S.big('#f87171')}>{risk.p95Shortfall?.toLocaleString()} <span style={{fontSize:14, fontWeight:400, color:'#94a3b8'}}>MW</span></div>
                  <div style={S.sub}>Extreme worst-case generation deficit threshold</div>
                </div>
              </div>
            )}

            {/* Gate Closure Sensitivity Comparison */}
            {monthData.sensitivity && (
              <div style={S.chart}>
                <h3 style={{margin:'0 0 4px', fontWeight:700}}>Gate Closure Sensitivity Comparison (Whole Month)</h3>
                <p style={{color:'#64748b', fontSize:12, margin:'0 0 16px'}}>
                  Evaluating how delaying the D-1 decision window improves forecast accuracy and compresses required thermal reserves.
                </p>
                <div style={{overflowX:'auto'}}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>D-1 Gate Closure</th>
                        <th style={S.th}>MAE (MW)</th>
                        <th style={S.th}>RMSE (MW)</th>
                        <th style={S.th}>Bias (MW)</th>
                        <th style={S.th}>P90 Shortfall (MW)</th>
                        <th style={S.th}>Accuracy</th>
                        <th style={S.th}>Thermal Over-Forecast %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthData.sensitivity.map(row => {
                        const isCurrent = row.cutoff === cutoff
                        return (
                          <tr key={row.cutoff} style={{
                            background: isCurrent ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                            fontWeight: isCurrent ? 700 : 400
                          }}>
                            <td style={{...S.td, color: isCurrent ? '#38bdf8' : '#f8fafc'}}>
                              {row.label} {isCurrent && <span style={{fontSize:10, color:'#38bdf8', padding:'2px 6px', background:'rgba(56, 189, 248, 0.15)', borderRadius:4, marginLeft:6}}>ACTIVE</span>}
                            </td>
                            <td style={{...S.td, color:'#38bdf8'}}>{row.mae?.toLocaleString()}</td>
                            <td style={{...S.td, color:'#a78bfa'}}>{row.rmse?.toLocaleString()}</td>
                            <td style={{...S.td, color:'#fb923c'}}>+{row.bias?.toLocaleString()}</td>
                            <td style={{...S.td, color:'#f87171'}}>{row.p90Shortfall?.toLocaleString()}</td>
                            <td style={{...S.td, color:'#4ade80'}}>{row.accuracy}%</td>
                            <td style={S.td}>{row.pctOver}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Diurnal (Time-of-Day) Error Profile */}
            {monthData.diurnal && (
              <div style={S.chart}>
                <h3 style={{margin:'0 0 4px', fontWeight:700}}>Diurnal Error Profile by Settlement Period (Jan 2026 Average)</h3>
                <p style={{color:'#64748b', fontSize:12, margin:'0 0 16px'}}>
                  Average over-forecast bias peaks in the early morning ramps (03:00–06:00 UTC) and moderates in afternoon peak hours.
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={monthData.diurnal} margin={{ top: 10, right: 16, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gDiaBias" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="10%" stopColor="#fb923c" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#fb923c" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gDiaMae" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="10%" stopColor="#38bdf8" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false}/>
                    <XAxis dataKey="time" stroke="#475569" tick={{fontSize:10}} axisLine={false} tickLine={false} interval={5}/>
                    <YAxis stroke="#475569" tick={{fontSize:11}} axisLine={false} tickLine={false} unit=" MW"/>
                    <Tooltip {...tooltipStyle}
                      labelFormatter={t => `Settlement Time: ${t} UTC`}
                      formatter={(v, n) => [`${v.toLocaleString()} MW`, n === 'bias' ? 'Average Bias (Over-forecast)' : 'Mean Absolute Error (MAE)']}/>
                    <Legend wrapperStyle={{ paddingTop: 10 }} formatter={v => v === 'bias' ? 'Average Bias (Over-forecast Deficit)' : 'Mean Absolute Error (MAE)'}/>
                    <Area type="monotone" dataKey="bias" stroke="#fb923c" fill="url(#gDiaBias)" strokeWidth={2} name="bias"/>
                    <Area type="monotone" dataKey="mae" stroke="#38bdf8" fill="url(#gDiaMae)" strokeWidth={2} strokeDasharray="4 3" name="mae"/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Daily MAE & Bias bar chart across January 2026 */}
            <div style={S.chart}>
              <h3 style={{margin:'0 0 4px', fontWeight:700}}>Daily MAE & Bias — January 2026</h3>
              <p style={{color:'#64748b', fontSize:12, margin:'0 0 16px'}}>
                High MAE days correspond to volatile storm passages across the UK North Sea wind belt.
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={monthData.daily.map(d => ({
                    day:  d.date.slice(8),
                    mae:  d.metrics.mae,
                    bias: d.metrics.bias,
                  }))}
                  margin={{ top: 10, right: 16, left: 10, bottom: 22 }}
                >
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="day" stroke="#475569" tick={{fontSize:11}} axisLine={false} tickLine={false}
                    label={{value:'Day of January 2026', position:'insideBottom', offset:-10, fill:'#94a3b8', fontSize:12}}/>
                  <YAxis stroke="#475569" tick={{fontSize:11}} axisLine={false} tickLine={false} unit=" MW"/>
                  <Tooltip {...tooltipStyle} labelFormatter={d=>`Jan ${d}, 2026`}
                    formatter={(v,n) => [`${v.toLocaleString()} MW`, n==='mae'?'Daily MAE':'Daily Bias']}/>
                  <Legend wrapperStyle={{ paddingTop: 26 }}/>
                  <Bar dataKey="mae"  name="Daily MAE"  fill="#38bdf8" radius={[4,4,0,0]} fillOpacity={0.85}/>
                  <Bar dataKey="bias" name="Daily Bias" fill="#f59e0b" radius={[4,4,0,0]} fillOpacity={0.85}/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Full January 2026 audit table */}
            <div style={{...S.chart, maxHeight:440, overflowY:'auto'}}>
              <h3 style={{margin:'0 0 16px', fontWeight:700}}>Full January 2026 Daily Error & Procurement Audit Table</h3>
              <table style={S.table}>
                <thead>
                  <tr>
                    {['Date','Avg Actual (MW)','Avg Forecast (MW)','MAE (MW)','RMSE (MW)','Bias (MW)','Accuracy %','Action'].map(h =>
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
                      <td style={{...S.td, color: d.metrics.bias>=0?'#f59e0b':'#10b981', fontWeight:600}}>
                        {d.metrics.bias>0?'+':''}{d.metrics.bias?.toLocaleString()}
                      </td>
                      <td style={{...S.td, color: d.metrics.accuracy>=85?'#10b981':d.metrics.accuracy>=70?'#f59e0b':'#ef4444', fontWeight:600}}>
                        {d.metrics.accuracy}%
                      </td>
                      <td style={S.td}>
                        <button onClick={()=>{setTab('daily');setSelDate(d.date);document.getElementById('dashboard-main')?.scrollIntoView({behavior:'smooth'})}}
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
