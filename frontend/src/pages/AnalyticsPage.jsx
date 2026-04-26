import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = localStorage.getItem('summareye_token');
        const res = await fetch('/api/analytics', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch analytics');
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error('Analytics fetch error:', e);
        if (e instanceof TypeError && e.message === 'Failed to fetch') {
          setError('CONNECTION_REFUSED: Backend unreachable.');
        } else {
          setError(e.message);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  // Format seconds to readable time
  const formatDuration = (seconds) => {
    if (!seconds) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-neon-panel border border-neon-green p-3 rounded text-xs font-mono">
          <p className="text-neon-green mb-1">{label}</p>
          {payload.map((p, i) => (
            <p key={i} className="text-neon-dim">
              {p.name}: <span className="text-neon-green font-bold">{p.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Pie chart colors
  const PIE_COLORS = ['#00ff41', '#ffcc00', '#ff0040'];

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-neon-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-neon-dim text-xs">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center border border-hacker-red rounded p-8 bg-neon-panel">
            <div className="text-hacker-red text-3xl mb-4">{'[!]'}</div>
            <p className="text-hacker-red text-sm font-mono">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Prepare pie chart data for status breakdown
  const statusData = data.status_breakdown
    ? Object.entries(data.status_breakdown).map(([name, value]) => ({ name, value }))
    : [];

  // Prepare bar chart data for label breakdown
  const labelData = data.label_breakdown
    ? Object.entries(data.label_breakdown).map(([name, value]) => ({ name: name.replace('_', ' '), value }))
    : [];

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />

      <div className="flex-1 overflow-y-auto relative">
        {/* Grid background */}
        <div className="absolute inset-0 grid-bg pointer-events-none opacity-50"></div>

        <div className="max-w-7xl mx-auto px-6 py-8 relative z-10">
          {/* Terminal header */}
          <div className="mb-8">
            <div className="text-[10px] text-neon-dark tracking-widest mb-2">
              root@summareye:~$
            </div>
            <h1 className="text-2xl font-bold text-neon-green text-glow-green">
              {'>'} system_overview
            </h1>
            <p className="text-neon-dim text-xs mt-1">
              Aggregate intelligence across all analysed surveillance feeds
            </p>
          </div>

          {/* Stats Grid — 4 cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Total Videos */}
            <div className="bg-neon-panel border border-neon-border rounded p-5 hover:border-neon-green transition-colors group">
              <div className="text-[10px] text-neon-dark uppercase tracking-wider mb-2 group-hover:text-neon-dim transition-colors">
                Videos Processed
              </div>
              <div className="text-3xl font-bold text-neon-green text-glow-green">
                {data.total_videos}
              </div>
            </div>

            {/* Total Events */}
            <div className="bg-neon-panel border border-neon-border rounded p-5 hover:border-neon-green transition-colors group">
              <div className="text-[10px] text-neon-dark uppercase tracking-wider mb-2 group-hover:text-neon-dim transition-colors">
                Events Detected
              </div>
              <div className="text-3xl font-bold text-neon-green text-glow-green">
                {data.total_events}
              </div>
            </div>

            {/* Critical Alerts */}
            <div className={`bg-neon-panel border rounded p-5 transition-colors group ${
              data.total_alerts > 0 ? 'border-hacker-red glow-red hover:border-hacker-red' : 'border-neon-border hover:border-neon-green'
            }`}>
              <div className="text-[10px] text-neon-dark uppercase tracking-wider mb-2 group-hover:text-neon-dim transition-colors">
                Critical Alerts
              </div>
              <div className={`text-3xl font-bold ${data.total_alerts > 0 ? 'text-hacker-red text-glow-red' : 'text-neon-dim'}`}>
                {data.total_alerts}
              </div>
            </div>

            {/* Footage Analysed */}
            <div className="bg-neon-panel border border-neon-border rounded p-5 hover:border-neon-green transition-colors group">
              <div className="text-[10px] text-neon-dark uppercase tracking-wider mb-2 group-hover:text-neon-dim transition-colors">
                Footage Analysed
              </div>
              <div className="text-3xl font-bold text-neon-green text-glow-green">
                {formatDuration(data.total_footage_s)}
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Alert Trend Chart */}
            <div className="bg-neon-panel border border-neon-border rounded p-5">
              <h3 className="text-xs font-bold text-neon-green mb-4 uppercase tracking-wider">
                {'>'} alert_trend.log
              </h3>
              {data.daily_alerts && data.daily_alerts.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data.daily_alerts}>
                    <defs>
                      <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00ff41" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#00ff41" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff0040" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ff0040" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a3a1a" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#003300', fontSize: 10, fontFamily: 'Fira Code' }}
                      tickFormatter={(d) => d.slice(5)} // Show MM-DD
                      axisLine={{ stroke: '#1a3a1a' }}
                    />
                    <YAxis
                      tick={{ fill: '#003300', fontSize: 10, fontFamily: 'Fira Code' }}
                      axisLine={{ stroke: '#1a3a1a' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="events" name="Events" stroke="#00ff41" fill="url(#greenGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="alerts" name="Alerts" stroke="#ff0040" fill="url(#redGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-neon-dark text-xs">
                  No event data available yet. Analyse some videos.
                </div>
              )}
            </div>

            {/* Event Distribution Bar Chart */}
            <div className="bg-neon-panel border border-neon-border rounded p-5">
              <h3 className="text-xs font-bold text-neon-green mb-4 uppercase tracking-wider">
                {'>'} event_distribution.log
              </h3>
              {labelData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={labelData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a3a1a" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#003300', fontSize: 9, fontFamily: 'Fira Code' }}
                      axisLine={{ stroke: '#1a3a1a' }}
                    />
                    <YAxis
                      tick={{ fill: '#003300', fontSize: 10, fontFamily: 'Fira Code' }}
                      axisLine={{ stroke: '#1a3a1a' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Count" radius={[2, 2, 0, 0]}>
                      {labelData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.name.includes('weapon') ? '#ff0040' : entry.name.includes('loitering') ? '#ffcc00' : '#00ff41'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-neon-dark text-xs">
                  No event data available yet.
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row — Status Breakdown + Recent Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Video Status Breakdown — Pie Chart */}
            <div className="bg-neon-panel border border-neon-border rounded p-5">
              <h3 className="text-xs font-bold text-neon-green mb-4 uppercase tracking-wider">
                {'>'} status_breakdown
              </h3>
              {statusData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={160}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={55}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="#000000"
                        strokeWidth={2}
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2 text-xs">
                    {statusData.map((entry, i) => (
                      <div key={entry.name} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}></span>
                        <span className="text-neon-dim">{entry.name}:</span>
                        <span className="text-neon-green font-bold">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[160px] flex items-center justify-center text-neon-dark text-xs">
                  No videos uploaded yet.
                </div>
              )}
            </div>

            {/* Recent Alerts Feed */}
            <div className="lg:col-span-2 bg-neon-panel border border-neon-border rounded p-5">
              <h3 className="text-xs font-bold text-neon-green mb-4 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-hacker-red animate-pulse"></span>
                {'>'} recent_alerts.log
              </h3>
              {data.recent_alerts && data.recent_alerts.length > 0 ? (
                <div className="space-y-2 max-h-[200px] overflow-y-auto font-mono">
                  {data.recent_alerts.map((alert, i) => (
                    <div key={alert.id} className="flex items-center gap-3 text-[11px] border-b border-neon-border/30 pb-2">
                      <span className="text-neon-dark w-4 text-right">{String(i + 1).padStart(2, '0')}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                        alert.label === 'weapon_detected'
                          ? 'border-hacker-red text-hacker-red'
                          : alert.label === 'loitering'
                          ? 'border-hacker-yellow text-hacker-yellow'
                          : 'border-neon-green text-neon-green'
                      }`}>
                        {alert.label.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-neon-dim truncate flex-1" title={alert.video_filename}>
                        {alert.video_filename}
                      </span>
                      <span className="text-neon-green font-bold">
                        {Math.round(alert.confidence * 100)}%
                      </span>
                      <span className="text-neon-dark text-[9px]">
                        {alert.created_at ? new Date(alert.created_at).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[160px] flex items-center justify-center text-neon-dark text-xs">
                  <div className="text-center">
                    <p className="mb-1">No critical alerts recorded.</p>
                    <p className="text-[10px]">Alerts appear when loitering or weapons are detected.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Avg confidence footer */}
          <div className="mt-8 text-center text-[10px] text-neon-dark border-t border-neon-border pt-4">
            avg_model_confidence: <span className="text-neon-green">{(data.avg_confidence * 100).toFixed(1)}%</span>
            <span className="mx-3">|</span>
            system_version: <span className="text-neon-green">1.0.0-mvp</span>
            <span className="mx-3">|</span>
            model: <span className="text-neon-green">yolov8n + weapon_custom</span>
          </div>
        </div>
      </div>
    </div>
  );
}
