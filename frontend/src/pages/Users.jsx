import DashboardLayout from "./DashboardLayout";
import { useProductivityData, formatMinutes, formatPercent } from "./dashboardData";

export default function UsersPage() {
  const { activity, loading, error, mode, setMode, selectedUser, setSelectedUser, selectedDate, setSelectedDate, users, availableDates, metrics, periodTitle, loadActivity } = useProductivityData();

  const userSummary = users.map((user) => {
    const rows = activity.filter((row) => row.user_type === user);
    const totalMinutes = rows.reduce((sum, row) => sum + Number(row.duration_minutes || 0), 0);
    const productiveMinutes = rows.filter((row) => String(row.productivity || "").toLowerCase() === "productive").reduce((sum, row) => sum + Number(row.duration_minutes || 0), 0);
    const focusScore = totalMinutes > 0 ? (productiveMinutes / totalMinutes) * 100 : 0;
    return { user, totalMinutes, productiveMinutes, focusScore, sessions: rows.length };
  }).sort((a, b) => b.focusScore - a.focusScore);

  return (
    <DashboardLayout
      title="Users"
      subtitle="Monitoring productivity across all users."
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
      currentPage="users"
    >
      {loading ? (
        <div className="panel empty-panel"><div className="empty-state">Loading users...</div></div>
      ) : error ? (
        <div className="panel empty-panel"><div className="empty-state">{error}</div></div>
      ) : (
        <div className="panel">
          <div className="panel-header"><div><h2>User Performance</h2><p>Focus score ranking across all tracked users</p></div></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Screen Time</th>
                  <th>Productive Time</th>
                  <th>Focus Score</th>
                  <th>Sessions</th>
                </tr>
              </thead>
              <tbody>
                {userSummary.map((entry) => (
                  <tr key={entry.user} className={entry.user === selectedUser ? "selected-row" : ""}>
                    <td>{entry.user}</td>
                    <td>{formatMinutes(entry.totalMinutes)}</td>
                    <td>{formatMinutes(entry.productiveMinutes)}</td>
                    <td>{formatPercent(entry.focusScore)}</td>
                    <td>{entry.sessions}</td>
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
