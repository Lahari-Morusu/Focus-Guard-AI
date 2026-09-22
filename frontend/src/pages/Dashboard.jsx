import { useMemo } from "react";
import {
  Activity,
  ArrowRight,
  Clock3,
  Monitor,
  RefreshCw,
  Coffee,
  AlertTriangle,
  Target,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DashboardLayout from "./DashboardLayout";
import { useProductivityData, formatMinutes, formatPercent, calculateFocusStreak } from "./dashboardData";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="chart-tooltip">
      <div className="tooltip-label">{label}</div>
      {payload.map((item, index) => (
        <div className="tooltip-row" key={index}>
          <span>{item.name}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, description, accent = "cyan" }) {
  return (
    <div className={`kpi-card ${accent}`}>
      <div className="kpi-top">
        <div className="kpi-icon"><Icon size={19} /></div>
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-description">{description}</div>
    </div>
  );
}

function ComparisonRow({ label, current, previous, formatter, betterIsLower }) {
  const delta = previous === 0 ? (current === 0 ? 0 : 100) : ((current - previous) / previous) * 100;
  const improved = betterIsLower ? current <= previous : current >= previous;
  const arrow = improved ? "↓" : "↑";
  const percent = Math.abs(delta);
  const toneClass = improved ? "positive" : "negative";

  if (betterIsLower) {
    return (
      <div className="comparison-row">
        <span className="comparison-label">{label}</span>
        <div className="comparison-values">
          <strong>{formatter(current)}</strong>
          <span className={`comparison-change ${toneClass}`}>{arrow} {percent.toFixed(0)}%</span>
        </div>
      </div>
    );
  }

  return (
    <div className="comparison-row">
      <span className="comparison-label">{label}</span>
      <div className="comparison-values">
        <strong>{formatter(current)}</strong>
        <span className={`comparison-change ${toneClass}`}>{arrow} {percent.toFixed(0)}%</span>
      </div>
    </div>
  );
}

function buildRecommendations(metrics, topApplications, switchAnalytics, timelineData) {
  const recommendations = [];
  const totalMinutes = Number(metrics.totalMinutes || 0);
  const productiveMinutes = Number(metrics.productiveMinutes || 0);
  const nonProductiveMinutes = Number(metrics.nonProductiveMinutes || 0);
  const focusScore = Number(metrics.focusScore || 0);
  const topApp = topApplications[0];
  const busiestNonProductive = timelineData
    .filter((bucket) => Number(bucket.nonProductive || 0) > 0)
    .sort((a, b) => Number(b.nonProductive || 0) - Number(a.nonProductive || 0))[0];

  if (focusScore < 50) {
    recommendations.push({
      type: "priority",
      icon: AlertTriangle,
      title: "Protect your next focus block",
      text: `Your focus score is ${focusScore.toFixed(1)}%. Start with one important task for 45-60 minutes and keep non-essential apps closed.`,
    });
  } else if (focusScore < 75) {
    recommendations.push({
      type: "focus",
      icon: Target,
      title: "Turn steady focus into momentum",
      text: `You are at ${focusScore.toFixed(1)}% focus. Add one uninterrupted work block to increase productive time beyond ${Math.round(productiveMinutes)} minutes.`,
    });
  } else {
    recommendations.push({
      type: "positive",
      icon: Zap,
      title: "Keep your focus rhythm",
      text: `Your ${focusScore.toFixed(1)}% focus score is strong. Use this window for your most important work before routine tasks.`,
    });
  }

  if (nonProductiveMinutes > productiveMinutes && totalMinutes > 0) {
    recommendations.push({
      type: "time",
      icon: Coffee,
      title: "Reduce non-productive time",
      text: `${formatMinutes(nonProductiveMinutes)} was non-productive versus ${formatMinutes(productiveMinutes)} productive. Take a short break, then return with one clearly defined task.`,
    });
  } else if (busiestNonProductive) {
    recommendations.push({
      type: "time",
      icon: Coffee,
      title: `Plan a break around ${busiestNonProductive.label}`,
      text: `This is your largest non-productive period. Step away for 5-10 minutes, then restart with your priority task.`,
    });
  }

  if (switchAnalytics.maxPair) {
    const [from, to, count] = switchAnalytics.maxPair;
    recommendations.push({
      type: "switching",
      icon: RefreshCw,
      title: "Slow down app switching",
      text: `You switched from ${from} to ${to} ${count} time${count === 1 ? "" : "s"}. Finish the current task before opening the next app, and batch similar work together.`,
    });
  } else if (topApp) {
    recommendations.push({
      type: "app",
      icon: Monitor,
      title: `Review time spent in ${topApp.app}`,
      text: `${topApp.app} used ${formatMinutes(topApp.minutes)} across ${topApp.sessions} session${topApp.sessions === 1 ? "" : "s"}. Keep it open only when it supports your current task.`,
    });
  }

  return recommendations;
}

export default function Dashboard() {
  const {
    loading,
    error,
    mode,
    setMode,
    selectedUser,
    setSelectedUser,
    selectedDate,
    setSelectedDate,
    users,
    availableDates,
    activity,
    metrics,
    switchAnalytics,
    comparisonMetrics,
    trendData,
    topApplications,
    productivityData,
    timelineData,
    periodTitle,
    focusStatus,
    loadActivity,
  } = useProductivityData();

  const focusStreak = useMemo(() => {
    const userRows = activity.filter((row) => row.user_type === selectedUser);
    return calculateFocusStreak(userRows);
  }, [activity, selectedUser]);

  return (
    <DashboardLayout
      title="Focus Dashboard"
      subtitle={`Track focus, screen time and application switching for ${selectedUser}.`}
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
      switchAnalytics={switchAnalytics}
      focusStatus={focusStatus}
      topApplications={topApplications}
      timelineData={timelineData}
      currentPage="dashboard"
    >
      {loading ? (
        <div className="panel empty-panel"><div className="empty-state">Loading productivity analytics...</div></div>
      ) : error ? (
        <div className="panel empty-panel"><div className="empty-state">{error}</div></div>
      ) : (
        <>
          <div className="kpi-grid">
            <KpiCard icon={Clock3} label="Screen Time" value={formatMinutes(metrics.totalMinutes)} description="Total active session time" accent="blue" />
            <KpiCard icon={Target} label="Productive Time" value={formatMinutes(metrics.productiveMinutes)} description={`${metrics.productiveSessions} productive sessions`} accent="green" />

            <div className="kpi-card focus-card">
              <div className="focus-card-inner">
                <div>
                  <div className="kpi-top">
                    <div className="kpi-icon"><Target size={19} /></div>
                    <span className="kpi-label">Focus Score</span>
                  </div>
                  <div className="kpi-value">{formatPercent(metrics.focusScore)}</div>
                  <div className={`focus-status ${focusStatus.className}`}>{focusStatus.label}</div>
                </div>

                <div className="focus-ring">
                  <svg viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" className="ring-bg" />
                    <circle cx="50" cy="50" r="42" className="ring-value" style={{ strokeDasharray: `${Math.min(metrics.focusScore, 100) * 2.64} 264` }} />
                  </svg>
                  <span>{Math.round(metrics.focusScore)}</span>
                </div>
              </div>
              <div className="kpi-description">Productive time ÷ total screen time</div>
            </div>

            <div className="kpi-card streak-card">
              <div className="kpi-top">
                <div className="kpi-icon"><Zap size={19} /></div>
                <span className="kpi-label">🔥 Focus Streak</span>
              </div>
              <div className="kpi-value">{focusStreak.days} {focusStreak.days === 1 ? "Day" : "Days"}</div>
              <div className="kpi-description">{focusStreak.message}</div>
            </div>
          </div>

          <section className="panel comparison-panel">
            <div className="panel-header comparison-header">
              <div>
                <h2>📈 Compared With Previous Period</h2>
                <p>Compared against the previous equivalent {mode} for {selectedUser}.</p>
              </div>
            </div>
            <div className="comparison-list">
              <ComparisonRow
                label={comparisonMetrics.screenTime.label}
                current={comparisonMetrics.screenTime.current}
                previous={comparisonMetrics.screenTime.previous}
                formatter={comparisonMetrics.screenTime.formatter}
                betterIsLower={comparisonMetrics.screenTime.betterIsLower}
              />
              <ComparisonRow
                label={comparisonMetrics.productiveTime.label}
                current={comparisonMetrics.productiveTime.current}
                previous={comparisonMetrics.productiveTime.previous}
                formatter={comparisonMetrics.productiveTime.formatter}
                betterIsLower={comparisonMetrics.productiveTime.betterIsLower}
              />
              <ComparisonRow
                label={comparisonMetrics.focusScore.label}
                current={comparisonMetrics.focusScore.current}
                previous={comparisonMetrics.focusScore.previous}
                formatter={comparisonMetrics.focusScore.formatter}
                betterIsLower={comparisonMetrics.focusScore.betterIsLower}
              />
              <ComparisonRow
                label={comparisonMetrics.appSwitches.label}
                current={comparisonMetrics.appSwitches.current}
                previous={comparisonMetrics.appSwitches.previous}
                formatter={comparisonMetrics.appSwitches.formatter}
                betterIsLower={comparisonMetrics.appSwitches.betterIsLower}
              />
            </div>
          </section>

          <section className="panel trend-panel">
            <div className="panel-header">
              <div>
                <h2>📉 Current vs Previous Period Trend</h2>
                <p>Trend view across the selected {mode} compared with the previous equivalent period.</p>
              </div>
              <div className="legend">
                <span><i className="legend-dot productive" />Current</span>
                <span><i className="legend-dot nonproductive" />Previous</span>
              </div>
            </div>

            <div className="trend-chart">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="currentTrendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#46e6d0" stopOpacity={0.38} />
                      <stop offset="100%" stopColor="#46e6d0" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="previousTrendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#9aa7b7" stopOpacity={0.26} />
                      <stop offset="100%" stopColor="#9aa7b7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fill: "#778295", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={10} />
                  <YAxis tick={{ fill: "#778295", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="current" name="Current" stroke="#46e6d0" strokeWidth={2.5} fill="url(#currentTrendGradient)" />
                  <Area type="monotone" dataKey="previous" name="Previous" stroke="#9aa7b7" strokeWidth={2} fill="url(#previousTrendGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="recommendation-panel dashboard-recommendations">
            <div className="recommendation-heading">
              <div className="recommendation-icon"><Zap size={17} /></div>
              <div>
                <span className="eyebrow">PERSONALIZED GUIDANCE</span>
                <h2>Recommendations for {selectedUser}</h2>
                <p>Based on your focus score, time balance, app usage, and switching behavior in {periodTitle}.</p>
              </div>
            </div>
            <div className="recommendation-list">
              {buildRecommendations(metrics, topApplications, switchAnalytics, timelineData).map(({ type, icon: Icon, title, text }) => (
                <article className={`recommendation-item recommendation-${type}`} key={title}>
                  <div className="recommendation-item-icon"><Icon size={15} /></div>
                  <div><strong>{title}</strong><p>{text}</p></div>
                </article>
              ))}
            </div>
          </section>

          <div className="chart-grid">
            <div className="panel timeline-panel">
              <div className="panel-header">
                <div>
                  <h2>Focus Timeline</h2>
                  <p>Productive and non-productive activity across the selected period.</p>
                </div>
                <div className="legend">
                  <span><i className="legend-dot productive" />Productive</span>
                  <span><i className="legend-dot nonproductive" />Non-Productive</span>
                </div>
              </div>

              <div className="timeline-chart">
                <ResponsiveContainer width="100%" height={290}>
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id="productiveGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#46e6d0" stopOpacity={0.38} />
                        <stop offset="100%" stopColor="#46e6d0" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="nonProductiveGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#596579" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#596579" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fill: "#778295", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={18} />
                    <YAxis tick={{ fill: "#778295", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="productive" name="Productive" stroke="#46e6d0" strokeWidth={2} fill="url(#productiveGradient)" />
                    <Area type="monotone" dataKey="nonProductive" name="Non-Productive" stroke="#64748b" strokeWidth={1.5} fill="url(#nonProductiveGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel distribution-panel">
              <div className="panel-header">
                <div>
                  <h2>Focus Distribution</h2>
                  <p>Productive vs non-productive time.</p>
                </div>
              </div>

              <div className="donut-container">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={productivityData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={68} outerRadius={90} paddingAngle={4} stroke="none">
                      <Cell fill="#46e6d0" />
                      <Cell fill="#3d4655" />
                    </Pie>
                    <Tooltip formatter={(value) => `${Number(value).toFixed(1)} min`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <strong>{formatPercent(metrics.focusScore)}</strong>
                  <span>Focus</span>
                </div>
              </div>

              <div className="distribution-list">
                <div className="distribution-item">
                  <div className="distribution-name"><span className="distribution-dot productive" />Productive</div>
                  <strong>{formatMinutes(metrics.productiveMinutes)}</strong>
                </div>
                <div className="distribution-item">
                  <div className="distribution-name"><span className="distribution-dot nonproductive" />Non-Productive</div>
                  <strong>{formatMinutes(metrics.nonProductiveMinutes)}</strong>
                </div>
                <div className="distribution-item total">
                  <div className="distribution-name"><span className="distribution-dot total-dot" />Total Screen Time</div>
                  <strong>{formatMinutes(metrics.totalMinutes)}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="lower-grid">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2>Top Applications</h2>
                  <p>Where your screen time is going.</p>
                </div>
                <Monitor size={18} />
              </div>

              <div className="application-list">
                {topApplications.length === 0 ? (
                  <div className="empty-state">No application activity.</div>
                ) : (
                  topApplications.map((app, index) => {
                    const percentage = metrics.totalMinutes > 0 ? (app.minutes / metrics.totalMinutes) * 100 : 0;
                    const productive = app.productive > 0;

                    return (
                      <div className="application-row" key={app.app}>
                        <div className="app-rank">{String(index + 1).padStart(2, "0")}</div>
                        <div className="app-main">
                          <div className="app-title-row">
                            <strong>{app.app}</strong>
                            <span>{formatMinutes(app.minutes)}</span>
                          </div>
                          <div className="app-progress"><div style={{ width: `${Math.min(percentage, 100)}%` }} /></div>
                          <div className="app-meta">
                            <span>{app.sessions} session{app.sessions !== 1 ? "s" : ""}</span>
                            <span className={productive ? "productive-text" : "nonproductive-text"}>{productive ? "Productive" : "Non-Productive"}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2>App Switching</h2>
                  <p>Most frequent application transitions.</p>
                </div>
                <RefreshCw size={18} />
              </div>

              <div className="switch-summary">
                <div className="switch-big">
                  <span>Total switches</span>
                  <strong>{switchAnalytics.switchCount}</strong>
                </div>
                {switchAnalytics.maxPair && (
                  <div className="most-switched">
                    <span>MOST FREQUENT</span>
                    <strong>{switchAnalytics.maxPair[0]}</strong>
                    <div className="switch-count">{switchAnalytics.maxPair[1]} switch{switchAnalytics.maxPair[1] !== 1 ? "es" : ""}</div>
                  </div>
                )}
              </div>

              <div className="switch-list">
                {switchAnalytics.topPairs.length === 0 ? (
                  <div className="empty-state">No app switches in this period.</div>
                ) : (
                  switchAnalytics.topPairs.map(([pair, count]) => (
                    <div className="switch-row" key={pair}>
                      <div className="switch-pair">
                        <span>{pair.split(" → ")[0]}</span>
                        <ArrowRight size={15} />
                        <span>{pair.split(" → ")[1]}</span>
                      </div>
                      <strong>{count}</strong>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="panel session-panel">
              <div className="panel-header">
                <div>
                  <h2>Session Activity</h2>
                  <p>Activity breakdown for this period.</p>
                </div>
                <Activity size={18} />
              </div>

              <div className="session-chart">
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={[{ name: "Sessions", Productive: metrics.productiveSessions, "Non-Productive": metrics.nonProductiveSessions }]} barCategoryGap="35%">
                    <XAxis dataKey="name" hide />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="Productive" fill="#46e6d0" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Non-Productive" fill="#465064" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="session-stats">
                <div>
                  <span className="stat-icon productive-bg"><Target size={14} /></span>
                  <div><span>Productive</span><strong>{metrics.productiveSessions}</strong></div>
                </div>
                <div>
                  <span className="stat-icon neutral-bg"><Clock3 size={14} /></span>
                  <div><span>Total Sessions</span><strong>{metrics.sessionCount}</strong></div>
                </div>
                <div>
                  <span className="stat-icon purple-bg"><Activity size={14} /></span>
                  <div><span>Non-Productive</span><strong>{metrics.nonProductiveSessions}</strong></div>
                </div>
              </div>
            </div>
          </div>

          {switchAnalytics.maxPair && (
            <div className="highlight-card">
              <div className="highlight-icon"><Zap size={22} /></div>
              <div className="highlight-content">
                <span>MOST SWITCHED APPLICATION PAIR</span>
                <strong>{switchAnalytics.maxPair[0]}</strong>
                <p>This transition occurred <b>{switchAnalytics.maxPair[1]}</b> time{switchAnalytics.maxPair[1] !== 1 ? "s" : ""} during the selected period.</p>
              </div>
              <div className="highlight-number">
                <strong>{switchAnalytics.maxPair[1]}</strong>
                <span>switches</span>
              </div>
            </div>
          )}

          <footer className="dashboard-footer">
            <span>Focus Guard AI</span>
            <span>Productivity analytics dashboard</span>
            <span>Data from PostgreSQL</span>
          </footer>
        </>
      )}
    </DashboardLayout>
  );
}
