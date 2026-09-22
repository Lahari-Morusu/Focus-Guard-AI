import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Clock3, Target, TrendingUp } from "lucide-react";
import DashboardLayout from "./DashboardLayout";
import { useProductivityData, formatMinutes, formatPercent } from "./dashboardData";

export default function AnalyticsPage() {
  const { activity, loading, error, mode, setMode, selectedUser, setSelectedUser, selectedDate, setSelectedDate, users, availableDates, currentPeriod, metrics, periodTitle, loadActivity } = useProductivityData();

  const byDay = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - index));
    const key = date.toISOString().slice(0, 10);
    const rows = activity.filter((row) => row.user_type === selectedUser && row.opened_date && new Date(row.opened_date).toISOString().slice(0, 10) === key);
    const totalMinutes = rows.reduce((sum, row) => sum + Number(row.duration_minutes || 0), 0);
    const productiveMinutes = rows.filter((row) => String(row.productivity || "").toLowerCase() === "productive").reduce((sum, row) => sum + Number(row.duration_minutes || 0), 0);
    return {
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      totalMinutes,
      productiveMinutes,
      focusScore: totalMinutes > 0 ? (productiveMinutes / totalMinutes) * 100 : 0,
    };
  });

  const appSummary = Object.values(
    currentPeriod.reduce((map, row) => {
      const app = String(row.app_web || "Unknown").trim();
      if (!map[app]) map[app] = { app, total: 0, productive: 0 };
      map[app].total += Number(row.duration_minutes || 0);
      if (String(row.productivity || "").toLowerCase() === "productive") {
        map[app].productive += Number(row.duration_minutes || 0);
      }
      return map;
    }, {})
  ).sort((a, b) => b.total - a.total).slice(0, 6);

  return (
    <DashboardLayout
      title="Analytics"
      subtitle={`Performance insights for ${selectedUser}.`}
      selectedUser={selectedUser}
      setSelectedUser={setSelectedUser}
      selectedDate={selectedDate}
      setSelectedDate={setSelectedDate}
      availableDates={availableDates}
      users={users}
      mode={mode}
      setMode={setMode}
      periodTitle={periodTitle}
      loadActivity={loadActivity}
      metrics={metrics}
      switchAnalytics={{}}
      focusStatus={{ label: "Current focus" }}
      currentPage="analytics"
    >
      {loading ? (
        <div className="panel empty-panel"><div className="empty-state">Loading analytics...</div></div>
      ) : error ? (
        <div className="panel empty-panel"><div className="empty-state">{error}</div></div>
      ) : activity.length === 0 ? (
        <div className="panel empty-panel"><div className="empty-state">No data available for this user.</div></div>
      ) : (
        <>
          <div className="kpi-grid analytics-grid">
            <div className="kpi-card blue">
              <div className="kpi-top"><div className="kpi-icon"><Clock3 size={19} /></div><span className="kpi-label">Screen Time</span></div>
              <div className="kpi-value">{formatMinutes(metrics.totalMinutes)}</div>
              <div className="kpi-description">Across {metrics.sessionCount} sessions</div>
            </div>
            <div className="kpi-card green">
              <div className="kpi-top"><div className="kpi-icon"><Target size={19} /></div><span className="kpi-label">Focus Score</span></div>
              <div className="kpi-value">{formatPercent(metrics.focusScore)}</div>
              <div className="kpi-description">Productive time ratio</div>
            </div>
            <div className="kpi-card purple">
              <div className="kpi-top"><div className="kpi-icon"><TrendingUp size={19} /></div><span className="kpi-label">Productive Time</span></div>
              <div className="kpi-value">{formatMinutes(metrics.productiveMinutes)}</div>
              <div className="kpi-description">{metrics.productiveSessions} productive sessions</div>
            </div>
            <div className="kpi-card cyan">
              <div className="kpi-top"><div className="kpi-icon"><Activity size={19} /></div><span className="kpi-label">App Focus</span></div>
              <div className="kpi-value">{appSummary.length > 0 ? appSummary[0].app : "—"}</div>
              <div className="kpi-description">Top application</div>
            </div>
          </div>

          <div className="chart-grid">
            <div className="panel">
              <div className="panel-header">
                <div><h2>Last 14 Days</h2><p>Focus score trend for {selectedUser}</p></div>
              </div>
              <div className="timeline-chart" style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={byDay}>
                    <defs>
                      <linearGradient id="focusArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#46e6d0" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#46e6d0" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#243041" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#8da1b9", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#8da1b9", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                    <Area type="monotone" dataKey="focusScore" stroke="#46e6d0" strokeWidth={2.5} fill="url(#focusArea)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div><h2>Top Applications</h2><p>Screen time share by app</p></div>
              </div>
              <div className="timeline-chart" style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={appSummary} layout="vertical" margin={{ left: 8 }}>
                    <XAxis type="number" tick={{ fill: "#8da1b9", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="app" width={80} tick={{ fill: "#8da1b9", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value) => formatMinutes(value)} />
                    <Bar dataKey="total" fill="#46e6d0" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
