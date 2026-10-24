import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, BarChart, Bar, ReferenceLine
} from 'recharts';
import {
  Wind, Zap, AlertTriangle, TrendingUp, Calendar, Clock,
  CheckCircle2, ArrowUpRight, ArrowDownRight, RefreshCw,
  Info, BarChart3, ShieldAlert, Cpu
} from 'lucide-react';

interface Metrics {
  count: number;
  mae: number;
  rmse: number;
  meanBias: number;
  mape: number;
  maxOverForecast: number;
  maxUnderForecast: number;
  avgActual: number;
  avgForecast: number;
  accuracyPercent: number;
}

interface DataPoint {
  startTime: string;
  date: string;
  time: string;
  settlementPeriod?: number;
  actual: number;
  forecast: number;
  publishTime: string;
  error: number;
  absError: number;
  pctError: number;
  procurementRisk: string;
}

interface DailySummary {
  date: string;
  metrics: Metrics;
}

export default function App() {
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('2026-01-01');
  const [cutoffHour, setCutoffHour] = useState<number>(12);
  const [resolution, setResolution] = useState<'30min' | 'hourly'>('30min');
  const [loading, setLoading] = useState<boolean>(true);
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [dayMetrics, setDayMetrics] = useState<Metrics | null>(null);
  const [monthlyOverall, setMonthlyOverall] = useState<Metrics | null>(null);
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');

  // Fetch available dates
  useEffect(() => {
    fetch('/api/dates')
      .then(r => r.json())
      .then(res => {
        if (res.dates && res.dates.length > 0) {
          setDates(res.dates);
          setSelectedDate(res.dates[0]);
        }
      })
      .catch(err => console.error('Error fetching dates:', err));
  }, []);

  // Fetch forecast vs actual data
  useEffect(() => {
    if (!selectedDate) return;
    setLoading(true);
    fetch(`/api/forecast-vs-actual?date=${selectedDate}&cutoff_hour=${cutoffHour}&resolution=${resolution}`)
      .then(r => r.json())
      .then(res => {
        setDataPoints(res.data || []);
        setDayMetrics(res.metrics || null);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching data:', err);
        setLoading(false);
      });
  }, [selectedDate, cutoffHour, resolution]);

  // Fetch monthly aggregate metrics
  useEffect(() => {
    fetch(`/api/monthly-metrics?cutoff_hour=${cutoffHour}`)
      .then(r => r.json())
      .then(res => {
        setMonthlyOverall(res.overall);
        setDailySummaries(res.daily || []);
      })
      .catch(err => console.error('Error fetching monthly metrics:', err));
  }, [cutoffHour]);

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col font-sans">
      {/* Top Header / Navigation */}
      <header className="border-b border-slate-800 bg-[#0E1322]/80 backdrop-blur sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/20 text-white">
              <Wind className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  VoltWise UK
                </h1>
                <span className="px-2 py-0.5 text-xs font-semibold bg-cyan-950 text-cyan-400 border border-cyan-700/50 rounded-full">
                  Day-Ahead Procurement
                </span>
              </div>
              <p className="text-xs text-slate-400">
                UK National Grid Elexon BMRS Forecast Intelligence (Jan 2026)
              </p>
            </div>
          </div>

          {/* Action Tabs & Gate Closure Selector */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg bg-slate-900 p-1 border border-slate-800 text-sm">
              <button
                onClick={() => setActiveTab('daily')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  activeTab === 'daily'
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Delivery Day View
              </button>
              <button
                onClick={() => setActiveTab('monthly')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  activeTab === 'monthly'
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Jan 2026 Evaluation
              </button>
            </div>

            {/* Gate Closure Filter */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-400">D-1 Cutoff:</span>
              <select
                value={cutoffHour}
                onChange={e => setCutoffHour(Number(e.target.value))}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
              >
                <option value={11} className="bg-slate-900">11:00 UTC (EPEX Gate)</option>
                <option value={12} className="bg-slate-900">12:00 UTC (NordPool Gate)</option>
                <option value={17} className="bg-slate-900">17:00 UTC (Evening Run)</option>
                <option value={23} className="bg-slate-900">23:00 UTC (End of D-1)</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Executive Decision Context Banner */}
        <section className="bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-cyan-950/40 border border-cyan-800/30 rounded-2xl p-5 shadow-xl backdrop-blur">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <h2 className="text-sm font-semibold tracking-wide uppercase text-cyan-400">
                  Procurement Strategy Briefing
                </h2>
              </div>
              <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
                As a UK electricity retailer serving consumer demand, decisions made prior to Day-Ahead Gate Closure rely strictly on latest renewable forecasts. 
                When <span className="text-cyan-300 font-semibold">Forecast &gt; Actual</span>, a generation deficit occurs requiring thermal dispatch or expensive real-time cashout purchases.
              </p>
            </div>

            {/* High Level Quick Status */}
            <div className="flex items-center gap-4 bg-slate-950/70 border border-slate-800 px-4 py-2.5 rounded-xl">
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">January Accuracy</p>
                <p className="text-xl font-bold text-white">
                  {monthlyOverall?.accuracyPercent || '--'}%
                </p>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div>
                <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Mean Bias</p>
                <p className={`text-xl font-bold ${
                  (monthlyOverall?.meanBias || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {monthlyOverall?.meanBias ? `+${monthlyOverall.meanBias} MW` : '--'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Tab 1: Daily Delivery View */}
        {activeTab === 'daily' && (
          <div className="space-y-6">
            {/* Control Bar: Date Selector & Resolution */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <span className="font-medium">Target Delivery Date:</span>
                </div>
                <select
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  {dates.map(d => (
                    <option key={d} value={d}>
                      {d} {d === '2026-01-01' ? '(New Year Day)' : ''}
                    </option>
                  ))}
                </select>

                <div className="h-6 w-px bg-slate-800 hidden sm:block" />

                <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-800 rounded-lg text-xs">
                  <button
                    onClick={() => setResolution('30min')}
                    className={`px-2.5 py-1 rounded font-medium ${
                      resolution === '30min' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    30-Min (48 Settlement Periods)
                  </button>
                  <button
                    onClick={() => setResolution('hourly')}
                    className={`px-2.5 py-1 rounded font-medium ${
                      resolution === 'hourly' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    Hourly (24 Periods)
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Live Data Source: Elexon BMRS <code className="text-cyan-400">FUELHH</code> & <code className="text-cyan-400">WINDFOR</code>
              </div>
            </div>

            {/* Key Error Metric Cards for the Day */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* MAE */}
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Mean Absolute Error (MAE)
                    </p>
                    <h3 className="text-2xl font-extrabold text-white mt-1">
                      {dayMetrics?.mae.toLocaleString()} <span className="text-sm font-normal text-slate-400">MW</span>
                    </h3>
                  </div>
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Average deviation per period regardless of direction
                </p>
              </div>

              {/* RMSE */}
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Root Mean Square Error (RMSE)
                    </p>
                    <h3 className="text-2xl font-extrabold text-white mt-1">
                      {dayMetrics?.rmse.toLocaleString()} <span className="text-sm font-normal text-slate-400">MW</span>
                    </h3>
                  </div>
                  <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg border border-purple-500/20">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Penalizes large outlier forecast spikes heavily
                </p>
              </div>

              {/* Mean Bias */}
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Forecast Bias (Mean Error)
                    </p>
                    <h3 className={`text-2xl font-extrabold mt-1 ${
                      (dayMetrics?.meanBias || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {dayMetrics?.meanBias ? `${dayMetrics.meanBias > 0 ? '+' : ''}${dayMetrics.meanBias.toLocaleString()}` : '0'}{' '}
                      <span className="text-sm font-normal text-slate-400">MW</span>
                    </h3>
                  </div>
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
                    {(dayMetrics?.meanBias || 0) > 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {(dayMetrics?.meanBias || 0) > 0 
                    ? 'Systematic Over-forecast (Procurement Deficit Risk)' 
                    : 'Systematic Under-forecast (Surplus Wind Risk)'}
                </p>
              </div>

              {/* Day Accuracy / MAPE */}
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Day Model Accuracy
                    </p>
                    <h3 className="text-2xl font-extrabold text-cyan-400 mt-1">
                      {dayMetrics?.accuracyPercent}%
                    </h3>
                  </div>
                  <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  MAPE: {dayMetrics?.mape}% relative error
                </p>
              </div>
            </div>

            {/* Primary Time Series Chart: Actual vs Forecast */}
            <div className="bg-slate-900/70 border border-slate-800 p-5 rounded-2xl shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>Wind Generation: Day-Ahead Forecast vs Actual</span>
                    <span className="text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full font-medium">
                      {selectedDate}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Evaluated against forecasts locked before D-1 {cutoffHour}:00 UTC Gate Closure
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block shadow-sm shadow-cyan-400/50" />
                    <span className="text-slate-300 font-medium">Actual Wind (MW)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-amber-400 inline-block shadow-sm shadow-amber-400/50" />
                    <span className="text-slate-300 font-medium">Day-Ahead Forecast (MW)</span>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="h-80 flex items-center justify-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mr-2 text-cyan-400" />
                  Loading Elexon time series...
                </div>
              ) : (
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dataPoints} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} />
                      <YAxis
                        stroke="#64748b"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                        domain={['auto', 'auto']}
                        unit=" MW"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          color: '#f8fafc',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                        }}
                        formatter={(val: any, name: any) => [
                          `${Number(val).toLocaleString()} MW`,
                          name === 'actual' ? 'Actual Generation' : 'Day-Ahead Forecast'
                        ]}
                        labelFormatter={(label) => `Delivery Time: ${label} UTC`}
                      />
                      <Area
                        type="monotone"
                        dataKey="actual"
                        stroke="#22d3ee"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#actualGradient)"
                        name="actual"
                      />
                      <Area
                        type="monotone"
                        dataKey="forecast"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        strokeDasharray="4 2"
                        fillOpacity={1}
                        fill="url(#forecastGradient)"
                        name="forecast"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Secondary Chart: Forecast Error per Settlement Period */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 p-5 rounded-2xl shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-base font-bold text-white">
                      Quantified Error by Settlement Period (MW)
                    </h4>
                    <p className="text-xs text-slate-400">
                      Positive bar = Over-forecast (Deficit risk) | Negative bar = Under-forecast (Surplus wind)
                    </p>
                  </div>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dataPoints} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 11 }} unit=" MW" />
                      <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          color: '#f8fafc'
                        }}
                        formatter={(val: any) => [`${Number(val).toLocaleString()} MW`, 'Error (Forecast - Actual)']}
                        labelFormatter={(lbl) => `Time: ${lbl} UTC`}
                      />
                      <Bar
                        dataKey="error"
                        fill="#38bdf8"
                        shape={(props: any) => {
                          const { x, y, width, height, value } = props;
                          const fillColor = value > 0 ? '#f59e0b' : '#10b981';
                          return <rect x={x} y={y} width={width} height={height} fill={fillColor} rx={2} />;
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Day Procurement Insights */}
              <div className="bg-slate-900/70 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
                <div>
                  <h4 className="text-base font-bold text-white flex items-center gap-2 mb-3">
                    <Info className="w-5 h-5 text-cyan-400" />
                    Buyer Action Recommendations
                  </h4>
                  <div className="space-y-3 text-xs text-slate-300">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <p className="font-semibold text-slate-200">Thermal Procurement Buffer</p>
                      <p className="mt-1 text-slate-400">
                        Average error on this date was <span className="text-cyan-300 font-bold">{dayMetrics?.mae.toLocaleString()} MW</span>. 
                        Procurement teams should reserve this buffer capacity via flexible contracts.
                      </p>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <p className="font-semibold text-slate-200">Maximum Extreme Gap</p>
                      <p className="mt-1 text-slate-400">
                        Peak over-forecast reached <span className="text-amber-400 font-bold">+{dayMetrics?.maxOverForecast.toLocaleString()} MW</span>. 
                        Intra-day balancing trades were required to avoid imbalance penalties.
                      </p>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <p className="font-semibold text-slate-200">Forecast Publication Time</p>
                      <p className="mt-1 text-slate-400">
                        Latest matched forecast run locked at: <code className="text-cyan-400">{dataPoints[0]?.publishTime || 'N/A'}</code>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500">
                  Compliant with UK Wholesale Balancing & Settlement Code (BSC)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Monthly January 2026 Evaluation View */}
        {activeTab === 'monthly' && (
          <div className="space-y-6">
            {/* Monthly Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Settlement Periods</p>
                <h3 className="text-2xl font-extrabold text-white mt-1">
                  {monthlyOverall?.count.toLocaleString()} <span className="text-sm font-normal text-slate-400">periods (31 days)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-2">Full month of January 2026</p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Monthly MAE</p>
                <h3 className="text-2xl font-extrabold text-blue-400 mt-1">
                  {monthlyOverall?.mae.toLocaleString()} <span className="text-sm font-normal text-slate-400">MW</span>
                </h3>
                <p className="text-xs text-slate-400 mt-2">Normalized MAE: {monthlyOverall?.mape}%</p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Monthly RMSE</p>
                <h3 className="text-2xl font-extrabold text-purple-400 mt-1">
                  {monthlyOverall?.rmse.toLocaleString()} <span className="text-sm font-normal text-slate-400">MW</span>
                </h3>
                <p className="text-xs text-slate-400 mt-2">Standard metric for risk variance</p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Overall Mean Bias</p>
                <h3 className="text-2xl font-extrabold text-amber-400 mt-1">
                  +{monthlyOverall?.meanBias.toLocaleString()} <span className="text-sm font-normal text-slate-400">MW</span>
                </h3>
                <p className="text-xs text-slate-400 mt-2">Persistent over-estimation trend across Jan</p>
              </div>
            </div>

            {/* Daily MAE Trend across January 2026 */}
            <div className="bg-slate-900/70 border border-slate-800 p-5 rounded-2xl shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Daily Forecast Accuracy & Error (January 1 - 31, 2026)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Day-by-day Mean Absolute Error (MAE) trajectory to spot stormy and volatile periods
                  </p>
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dailySummaries.map(d => ({
                      date: d.date.slice(8), // day of month
                      fullDate: d.date,
                      mae: d.metrics.mae,
                      rmse: d.metrics.rmse,
                      meanBias: d.metrics.meanBias,
                      accuracy: d.metrics.accuracyPercent
                    }))}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} label={{ value: 'January Day of Month', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 11 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 11 }} unit=" MW" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        color: '#f8fafc'
                      }}
                      formatter={(val: any, name: any) => [
                        `${Number(val).toLocaleString()} MW`,
                        name === 'mae' ? 'Day MAE' : name === 'rmse' ? 'Day RMSE' : 'Mean Bias'
                      ]}
                      labelFormatter={(lbl) => `Jan ${lbl}, 2026`}
                    />
                    <Legend />
                    <Bar dataKey="mae" fill="#38bdf8" name="mae" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="meanBias" fill="#f59e0b" name="meanBias" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Daily Detailed Table */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h4 className="font-bold text-white text-sm">
                  Complete January 2026 Quantitative Audit Table
                </h4>
                <span className="text-xs text-slate-400">All 31 delivery days</span>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-semibold sticky top-0">
                    <tr>
                      <th className="p-3">Delivery Date</th>
                      <th className="p-3">Avg Actual Wind (MW)</th>
                      <th className="p-3">Avg Forecast (MW)</th>
                      <th className="p-3">MAE (MW)</th>
                      <th className="p-3">RMSE (MW)</th>
                      <th className="p-3">Bias (MW)</th>
                      <th className="p-3">Accuracy %</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {dailySummaries.map(d => (
                      <tr key={d.date} className="hover:bg-slate-800/40 transition">
                        <td className="p-3 font-semibold text-white">{d.date}</td>
                        <td className="p-3">{d.metrics.avgActual.toLocaleString()}</td>
                        <td className="p-3">{d.metrics.avgForecast.toLocaleString()}</td>
                        <td className="p-3 text-cyan-300 font-medium">{d.metrics.mae.toLocaleString()}</td>
                        <td className="p-3 text-purple-300">{d.metrics.rmse.toLocaleString()}</td>
                        <td className={`p-3 font-medium ${d.metrics.meanBias > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {d.metrics.meanBias > 0 ? '+' : ''}{d.metrics.meanBias.toLocaleString()}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold">
                            {d.metrics.accuracyPercent}%
                          </span>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => {
                              setSelectedDate(d.date);
                              setActiveTab('daily');
                            }}
                            className="text-cyan-400 hover:text-cyan-200 underline font-medium"
                          >
                            Inspect Day
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-[#0A0E1A] py-5 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 VoltWise UK • Built with React & Python for Wholesale Day-Ahead Procurement</p>
          <div className="flex items-center gap-4">
            <span>Data: Elexon BMRS API (FUELHH & WINDFOR)</span>
            <span>Evaluation: January 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
