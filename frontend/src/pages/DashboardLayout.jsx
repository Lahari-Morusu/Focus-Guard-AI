import { useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Bell,
  ChevronDown,
  Clock3,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Target,
  TrendingUp,
  User,
  Users,
  X,
  Zap,
  Flag,
} from "lucide-react";
import { useMemo, useState } from "react";
import Chatbot from "./Chatbot";

export default function DashboardLayout({
  title,
  subtitle,
  children,
  selectedUser,
  setSelectedUser,
  selectedDate,
  setSelectedDate,
  availableDates,
  users,
  mode,
  setMode,
  periodTitle,
  loadActivity,
  metrics,
  switchAnalytics,
  focusStatus,
  topApplications,
  timelineData,
  currentPage,
}) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = useMemo(
    () => [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
      { key: "analytics", label: "Analytics", icon: BarChart3, path: "/analytics" },
      { key: "activity", label: "Activity", icon: Activity, path: "/activity" },
      { key: "trends", label: "Trends", icon: TrendingUp, path: "/trends" },
      { key: "users", label: "Users", icon: Users, path: "/users" },
      { key: "goals", label: "Goals", icon: Flag, path: "/goals" },
    ],
    []
  );

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("isLoggedIn");
    navigate("/");
  };

  const chatContext = {
    selectedUser,
    mode,
    periodTitle,
    metrics,
    switchAnalytics,
    focusStatus,
    topApplications: topApplications || [],
    timelineData: timelineData || [],
  };

  return (
    <div className="app-shell">
      {sidebarOpen && <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Zap size={21} /></div>
          <div className="brand-text">
            <strong>Focus Guard</strong>
            <span>AI Analytics</span>
          </div>
          <button className="mobile-close" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">MAIN</div>
          {navItems.map(({ key, label, icon: Icon, path }) => (
            <button
              key={key}
              className={`nav-item ${currentPage === key ? "active" : ""}`}
              onClick={() => {
                setSidebarOpen(false);
                navigate(path);
              }}
              type="button"
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}

          <div className="nav-section second">MANAGEMENT</div>
          <button className="nav-item" onClick={handleLogout} type="button">
            <X size={19} />
            <span>Logout</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="system-status">
            <span className="status-dot" />
            <div>
              <strong>System Online</strong>
              <span>Analytics connected</span>
            </div>
          </div>
          <div className="profile-mini">
            <div className="avatar">{selectedUser?.replace("User", "").slice(0, 2)}</div>
            <div>
              <strong>{selectedUser}</strong>
              <span>Active user</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)} type="button">
            <Menu size={21} />
          </button>

          <div className="topbar-left">
            <div className="topbar-logo"><Zap size={18} /></div>
            <div>
              <strong>Focus Guard AI</strong>
              <span>Personal productivity intelligence</span>
            </div>
          </div>

          <div className="topbar-right">
            <button className="icon-button" onClick={loadActivity} type="button" title="Refresh">
              <RefreshCw size={18} />
            </button>
            <button className="icon-button" type="button">
              <Bell size={18} />
              <span className="notification-dot" />
            </button>
            <div className="top-user">
              <div className="avatar small">{selectedUser?.replace("User", "").slice(0, 2)}</div>
              <div className="top-user-info">
                <strong>{selectedUser}</strong>
                <span>Productivity profile</span>
              </div>
              <ChevronDown size={16} />
            </div>
          </div>
        </header>

        <section className="dashboard-content">
          <div className="page-header">
            <div>
              <div className="eyebrow">PRODUCTIVITY OVERVIEW</div>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>

            <div className="header-controls">
              <div className="select-wrapper">
                <User size={16} />
                <select value={selectedUser || ""} onChange={(e) => setSelectedUser(e.target.value)}>
                  {users.map((user) => (
                    <option key={user} value={user}>{user}</option>
                  ))}
                </select>
                <ChevronDown size={15} />
              </div>

              <div className="select-wrapper">
                <Clock3 size={16} />
                <select value={selectedDate || ""} onChange={(e) => setSelectedDate(e.target.value)}>
                  {(availableDates || []).slice().reverse().map((date) => (
                    <option key={date} value={date}>{date}</option>
                  ))}
                </select>
                <ChevronDown size={15} />
              </div>
            </div>
          </div>

          {mode && (
            <div className="period-row">
              <div className="period-tabs">
                {[["day", "Day"], ["week", "Week"], ["month", "Month"]].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={mode === value ? "period-tab active" : "period-tab"}
                    onClick={() => setMode(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="period-info">
                <Clock3 size={15} />
                <span>{periodTitle}</span>
              </div>
            </div>
          )}

          {children}
        </section>
      </main>

      <Chatbot {...chatContext} />
    </div>
  );
}
