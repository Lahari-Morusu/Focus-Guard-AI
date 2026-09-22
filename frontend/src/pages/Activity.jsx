import { useMemo } from "react";
import DashboardLayout from "./DashboardLayout";
import { useProductivityData, formatMinutes } from "./dashboardData";

export default function ActivityPage() {
  const { loading, error, mode, setMode, selectedUser, setSelectedUser, selectedDate, setSelectedDate, users, availableDates, currentPeriod, metrics, periodTitle, loadActivity } = useProductivityData();

  const rows = useMemo(() =>
    [...currentPeriod].sort((a, b) => new Date(a.opened_date) - new Date(b.opened_date)),
    [currentPeriod]
  );

  return (
    <DashboardLayout
      title="Activity"
      subtitle={`Recent sessions for ${selectedUser}.`}
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
      currentPage="activity"
    >
      {loading ? (
        <div className="panel empty-panel"><div className="empty-state">Loading activity...</div></div>
      ) : error ? (
        <div className="panel empty-panel"><div className="empty-state">{error}</div></div>
      ) : rows.length === 0 ? (
        <div className="panel empty-panel"><div className="empty-state">No activity found for this period.</div></div>
      ) : (
        <div className="panel">
          <div className="panel-header"><div><h2>Session Log</h2><p>{rows.length} sessions tracked</p></div></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Application</th>
                  <th>Productivity</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.opened_date}-${row.app_web}-${index}`}>
                    <td>{new Date(row.opened_date).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td>{row.app_web}</td>
                    <td><span className={`status-chip ${String(row.productivity || "").toLowerCase() === "productive" ? "productive" : "neutral"}`}>{row.productivity}</span></td>
                    <td>{formatMinutes(Number(row.duration_minutes || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
