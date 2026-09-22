import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import DashboardLayout from "./DashboardLayout";
import { useProductivityData } from "./dashboardData";

export default function TrendsPage() {
  const { activity, loading, error, mode, setMode, selectedUser, setSelectedUser, selectedDate, setSelectedDate, users, availableDates, currentPeriod, metrics, periodTitle, loadActivity } = useProductivityData();

  const trendData = Array.from({ length: 12 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (11 - index));
    const key = date.toISOString().slice(0, 10);
    const rows = activity.filter((row) => row.user_type === selectedUser && row.opened_date && new Date(row.opened_date).toISOString().slice(0, 10) === key);
    const total = rows.reduce((sum, row) => sum + Number(row.duration_minutes || 0), 0);
    const productive = rows.filter((row) => String(row.productivity || "").toLowerCase() === "productive").reduce((sum, row) => sum + Number(row.duration_minutes || 0), 0);
    return {
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      total,
      productive,
      focus: total > 0 ? (productive / total) * 100 : 0,
    };
  });

  return (
    <DashboardLayout
      title="Trends"
      subtitle={`Productivity trend for ${selectedUser}.`}
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
      currentPage="trends"
    >
      {loading ? (
        <div className="panel empty-panel"><div className="empty-state">Loading trends...</div></div>
      ) : error ? (
        <div className="panel empty-panel"><div className="empty-state">{error}</div></div>
      ) : trendData.every((row) => row.total === 0) ? (
        <div className="panel empty-panel"><div className="empty-state">No trend data available.</div></div>
      ) : (
        <div className="panel">
          <div className="panel-header">
            <div><h2>Focus Trend</h2><p>Productive minutes and focus over recent days</p></div>
          </div>
          <div className="timeline-chart" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="trendFocus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#46e6d0" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#46e6d0" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#243041" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#8da1b9", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={22} />
                <YAxis tick={{ fill: "#8da1b9", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                <Area type="monotone" dataKey="focus" stroke="#46e6d0" strokeWidth={2.5} fill="url(#trendFocus)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
