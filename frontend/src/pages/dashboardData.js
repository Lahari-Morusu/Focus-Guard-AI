import { useEffect, useMemo, useState } from "react";

export const DEFAULT_USER = "User1";

export function formatMinutes(minutes) {
  const value = Number(minutes || 0);
  const hours = Math.floor(value / 60);
  const mins = Math.round(value % 60);

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export function parseDurationMinutes(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const text = String(value).trim();
  if (!text) return 0;
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);

  const parts = text.split(":");
  if (parts.length === 3) {
    const [h, m, s] = parts.map(Number);
    return h * 60 + m + s / 60;
  }
  if (parts.length === 2) {
    const [m, s] = parts.map(Number);
    return m + s / 60;
  }

  const numeric = Number(text.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

export function dateKey(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfWeek(date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function getDuration(row) {
  if (row.duration_minutes !== undefined) {
    return Number(row.duration_minutes || 0);
  }
  if (row.duration !== undefined) {
    return parseDurationMinutes(row.duration);
  }
  if (row.opened_date && row.closed_date) {
    const start = new Date(row.opened_date);
    const end = new Date(row.closed_date);
    return Math.max(0, (end - start) / 60000);
  }
  return 0;
}

export function getDate(row) {
  return new Date(row.opened_date);
}

export function periodLabel(date, mode) {
  const d = new Date(date);
  if (mode === "day") {
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  if (mode === "week") {
    const start = startOfWeek(d);
    const end = endOfWeek(d);
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function getFocusStatus(score) {
  const value = Number(score || 0);
  if (value >= 80) return { label: "Excellent Focus", className: "excellent" };
  if (value >= 60) return { label: "Good Focus", className: "good" };
  if (value >= 30) return { label: "Moderate Focus", className: "moderate" };
  return { label: "Low Focus", className: "low" };
}

export function calculateFocusStreak(rows = []) {
  const byDate = new Map();

  rows.forEach((row) => {
    if (!row?.opened_date) return;
    const dateKeyValue = dateKey(row.opened_date);
    const total = Number(row.duration_minutes || getDuration(row) || 0);
    const productive = String(row.productivity || "").toLowerCase() === "productive" ? total : 0;

    if (!byDate.has(dateKeyValue)) {
      byDate.set(dateKeyValue, { total: 0, productive: 0 });
    }

    const day = byDate.get(dateKeyValue);
    day.total += total;
    day.productive += productive;
  });

  const sortedDates = [...byDate.keys()].sort((a, b) => new Date(a) - new Date(b));
  if (sortedDates.length === 0) {
    return { days: 0, message: "You've maintained a 60%+ focus score for 0 consecutive days." };
  }

  let streak = 0;
  let lastDate = null;

  for (let i = sortedDates.length - 1; i >= 0; i--) {
    const date = new Date(`${sortedDates[i]}T00:00:00`);
    if (lastDate && (lastDate.getTime() - date.getTime()) / 86400000 > 1) break;

    const day = byDate.get(sortedDates[i]);
    const focusScore = day.total > 0 ? (day.productive / day.total) * 100 : 0;
    if (focusScore >= 60) {
      streak += 1;
      lastDate = date;
    } else {
      break;
    }
  }

  return {
    days: streak,
    message: `You've maintained a 60%+ focus score for ${streak} consecutive day${streak === 1 ? "" : "s"}.`,
  };
}

function buildPeriodMetrics(rows = []) {
  const totalMinutes = rows.reduce((sum, row) => sum + Number(row._duration || 0), 0);
  const productiveMinutes = rows
    .filter((row) => String(row.productivity || "").toLowerCase() === "productive")
    .reduce((sum, row) => sum + Number(row._duration || 0), 0);
  const nonProductiveMinutes = Math.max(0, totalMinutes - productiveMinutes);
  const sessionCount = rows.length;
  const productiveSessions = rows.filter((row) => String(row.productivity || "").toLowerCase() === "productive").length;
  const focusScore = totalMinutes > 0 ? (productiveMinutes / totalMinutes) * 100 : 0;

  return {
    totalMinutes,
    productiveMinutes,
    nonProductiveMinutes,
    sessionCount,
    productiveSessions,
    nonProductiveSessions: sessionCount - productiveSessions,
    focusScore,
  };
}

function buildSwitchAnalytics(rows = []) {
  const sorted = [...rows].sort((a, b) => a._date - b._date);
  const fromFrequency = {};
  const toFrequency = {};
  const pairFrequency = {};

  for (let i = 0; i < sorted.length - 1; i++) {
    const from = String(sorted[i].app_web || "Unknown").trim();
    const to = String(sorted[i + 1].app_web || "Unknown").trim();
    if (!from || !to || from === to) continue;

    fromFrequency[from] = (fromFrequency[from] || 0) + 1;
    toFrequency[to] = (toFrequency[to] || 0) + 1;
    const pair = `${from} → ${to}`;
    pairFrequency[pair] = (pairFrequency[pair] || 0) + 1;
  }

  const pairs = Object.entries(pairFrequency).sort((a, b) => b[1] - a[1]);
  const fromApps = Object.entries(fromFrequency).sort((a, b) => b[1] - a[1]);
  const toApps = Object.entries(toFrequency).sort((a, b) => b[1] - a[1]);

  return {
    switchCount: pairs.reduce((sum, [, count]) => sum + count, 0),
    fromFrequency,
    toFrequency,
    pairFrequency,
    topPairs: pairs.slice(0, 6),
    topFrom: fromApps[0] || null,
    topTo: toApps[0] || null,
    maxPair: pairs[0] || null,
  };
}

function buildTrendSeries(rows = [], mode, selectedDate) {
  const selected = new Date(`${selectedDate}T00:00:00`);
  const labels = [];
  const map = new Map();

  if (mode === "day") {
    for (let hour = 0; hour < 24; hour += 1) {
      const label = `${String(hour).padStart(2, "0")}:00`;
      labels.push({ key: hour, label, value: 0 });
      map.set(hour, 0);
    }

    rows.forEach((row) => {
      const hour = row._date.getHours();
      map.set(hour, (map.get(hour) || 0) + Number(row._duration || 0));
    });
  } else if (mode === "week") {
    const start = startOfWeek(selected);
    for (let i = 0; i < 7; i += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = dateKey(date);
      labels.push({ key, label: date.toLocaleDateString("en-US", { weekday: "short" }), value: 0 });
      map.set(key, 0);
    }

    rows.forEach((row) => {
      const key = dateKey(row._date);
      map.set(key, (map.get(key) || 0) + Number(row._duration || 0));
    });
  } else {
    const year = selected.getFullYear();
    const month = selected.getMonth();
    const dayCount = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= dayCount; day += 1) {
      const key = String(day);
      labels.push({ key, label: String(day), value: 0 });
      map.set(key, 0);
    }

    rows.forEach((row) => {
      const key = String(row._date.getDate());
      map.set(key, (map.get(key) || 0) + Number(row._duration || 0));
    });
  }

  return labels.map((entry) => ({
    label: entry.label,
    current: map.get(entry.key) || 0,
  }));
}

export function calculateDelta(current, previous) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

export function useProductivityData() {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("day");

  const [selectedUser, setSelectedUser] = useState(() => {
    try {
      return localStorage.getItem("selectedUser") || DEFAULT_USER;
    } catch {
      return DEFAULT_USER;
    }
  });

  const [selectedDate, setSelectedDate] = useState(() => {
    try {
      return localStorage.getItem("selectedDate") || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem("selectedUser", selectedUser);
  }, [selectedUser]);

  useEffect(() => {
    if (selectedDate) {
      localStorage.setItem("selectedDate", selectedDate);
    }
  }, [selectedDate]);

  async function loadActivity() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/activity-data");
      if (!response.ok) throw new Error(`Backend returned ${response.status}`);

      const data = await response.json();
      const rows = Array.isArray(data) ? data : data.data || data.rows || [];
      const normalized = rows.map((row) => ({
        ...row,
        user_type: row.user_type || row.user || row.user_type || "Unknown",
        app_web: row.app_web || row.app || "Unknown",
        productivity: row.productivity || "Unknown",
        duration_minutes: Number(getDuration(row).toFixed(2)),
        opened_date: row.opened_date,
        closed_date: row.closed_date,
      }));

      setActivity(normalized);

      if (normalized.length > 0) {
        const users = [...new Set(normalized.map((row) => row.user_type).filter(Boolean))].sort();
        if (users.length > 0 && !users.includes(selectedUser)) {
          setSelectedUser(users[0]);
        }

        const userRows = normalized.filter((row) => row.user_type === selectedUser);
        if (userRows.length > 0) {
          const latestDate = [...userRows].sort((a, b) => new Date(a.opened_date) - new Date(b.opened_date)).at(-1);
          if (latestDate) setSelectedDate(dateKey(latestDate.opened_date));
        }
      }
    } catch (err) {
      console.error(err);
      setError("Unable to connect to the Focus Guard AI backend.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivity();
  }, []);

  const users = useMemo(() => {
    return [...new Set(activity.map((row) => row.user_type).filter(Boolean))].sort();
  }, [activity]);

  const userActivity = useMemo(() => {
    return activity
      .filter((row) => row.user_type === selectedUser)
      .map((row) => ({
        ...row,
        _duration: getDuration(row),
        _date: new Date(row.opened_date),
      }))
      .filter((row) => row._duration > 0)
      .sort((a, b) => a._date - b._date);
  }, [activity, selectedUser]);

  const availableDates = useMemo(() => {
    return [...new Set(userActivity.map((row) => dateKey(row._date)))];
  }, [userActivity]);

  useEffect(() => {
    if (availableDates.length > 0 && (!selectedDate || !availableDates.includes(selectedDate))) {
      setSelectedDate(availableDates[availableDates.length - 1]);
    }
  }, [availableDates, selectedDate]);

  const currentPeriod = useMemo(() => {
    if (!selectedDate) return [];
    const selected = new Date(`${selectedDate}T00:00:00`);

    return userActivity.filter((row) => {
      const date = row._date;
      if (mode === "day") return dateKey(date) === selectedDate;
      if (mode === "week") {
        const start = startOfWeek(selected);
        const end = endOfWeek(selected);
        return date >= start && date <= end;
      }
      return monthKey(date) === monthKey(selected);
    });
  }, [userActivity, selectedDate, mode]);

  const metrics = useMemo(() => buildPeriodMetrics(currentPeriod), [currentPeriod]);

  const switchAnalytics = useMemo(() => buildSwitchAnalytics(currentPeriod), [currentPeriod]);

  const previousPeriod = useMemo(() => {
    if (!selectedDate || !userActivity.length) return [];

    const selected = new Date(`${selectedDate}T00:00:00`);
    const applyWindow = (startDate, endDate) =>
      userActivity.filter((row) => {
        const date = row._date;
        return date >= startDate && date <= endDate;
      });

    if (mode === "day") {
      const previousDay = new Date(selected);
      previousDay.setDate(previousDay.getDate() - 1);
      const start = new Date(previousDay);
      start.setHours(0, 0, 0, 0);
      const end = new Date(previousDay);
      end.setHours(23, 59, 59, 999);
      return applyWindow(start, end);
    }

    if (mode === "week") {
      const currentStart = startOfWeek(selected);
      const previousStart = new Date(currentStart);
      previousStart.setDate(previousStart.getDate() - 7);
      const previousEnd = new Date(previousStart);
      previousEnd.setDate(previousStart.getDate() + 6);
      previousEnd.setHours(23, 59, 59, 999);
      return applyWindow(previousStart, previousEnd);
    }

    const previousMonthDate = new Date(selected.getFullYear(), selected.getMonth() - 1, 1);
    const previousMonthStart = new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 1);
    const previousMonthEnd = new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth() + 1, 0, 23, 59, 59, 999);
    return applyWindow(previousMonthStart, previousMonthEnd);
  }, [selectedDate, userActivity, mode]);

  const previousMetrics = useMemo(() => buildPeriodMetrics(previousPeriod), [previousPeriod]);
  const previousSwitchAnalytics = useMemo(() => buildSwitchAnalytics(previousPeriod), [previousPeriod]);

  const trendData = useMemo(() => {
    if (!selectedDate) return [];
    const currentSeries = buildTrendSeries(currentPeriod, mode, selectedDate);
    const previousSeries = buildTrendSeries(previousPeriod, mode, selectedDate);
    return currentSeries.map((entry, index) => ({
      label: entry.label,
      current: entry.current,
      previous: previousSeries[index]?.current || 0,
    }));
  }, [currentPeriod, previousPeriod, mode, selectedDate]);

  const comparisonMetrics = useMemo(() => ({
    screenTime: {
      current: metrics.totalMinutes,
      previous: previousMetrics.totalMinutes,
      betterIsLower: true,
      label: "Screen Time",
      formatter: (value) => formatMinutes(value),
    },
    productiveTime: {
      current: metrics.productiveMinutes,
      previous: previousMetrics.productiveMinutes,
      betterIsLower: false,
      label: "Productive Time",
      formatter: (value) => formatMinutes(value),
    },
    focusScore: {
      current: metrics.focusScore,
      previous: previousMetrics.focusScore,
      betterIsLower: false,
      label: "Focus Score",
      formatter: (value) => `${Number(value || 0).toFixed(0)}%`,
    },
    appSwitches: {
      current: switchAnalytics.switchCount,
      previous: previousSwitchAnalytics.switchCount,
      betterIsLower: true,
      label: "App Switches",
      formatter: (value) => `${Math.round(value)}`,
    },
  }), [metrics, previousMetrics, switchAnalytics, previousSwitchAnalytics]);

  const topApplications = useMemo(() => {
    const map = {};
    currentPeriod.forEach((row) => {
      const app = String(row.app_web || "Unknown").trim();
      if (!map[app]) map[app] = { app, minutes: 0, sessions: 0, productive: 0 };
      map[app].minutes += row._duration;
      map[app].sessions += 1;
      if (String(row.productivity || "").toLowerCase() === "productive") {
        map[app].productive += row._duration;
      }
    });

    return Object.values(map).sort((a, b) => b.minutes - a.minutes).slice(0, 6);
  }, [currentPeriod]);

  const productivityData = [
    { name: "Productive", value: Number(metrics.productiveMinutes.toFixed(2)) },
    { name: "Non-Productive", value: Number(metrics.nonProductiveMinutes.toFixed(2)) },
  ];

  const timelineData = useMemo(() => {
    if (mode === "day") {
      const buckets = [];
      for (let hour = 0; hour < 24; hour++) {
        const rows = currentPeriod.filter((row) => row._date.getHours() === hour);
        const total = rows.reduce((sum, row) => sum + row._duration, 0);
        const productive = rows
          .filter((row) => String(row.productivity || "").toLowerCase() === "productive")
          .reduce((sum, row) => sum + row._duration, 0);
        buckets.push({ label: `${String(hour).padStart(2, "0")}:00`, total: Math.round(total), productive: Math.round(productive), nonProductive: Math.round(total - productive) });
      }
      return buckets;
    }

    if (mode === "week") {
      const buckets = [];
      const base = startOfWeek(new Date(`${selectedDate}T00:00:00`));
      for (let i = 0; i < 7; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        const key = dateKey(d);
        const rows = currentPeriod.filter((row) => dateKey(row._date) === key);
        const total = rows.reduce((sum, row) => sum + row._duration, 0);
        const productive = rows
          .filter((row) => String(row.productivity || "").toLowerCase() === "productive")
          .reduce((sum, row) => sum + row._duration, 0);
        buckets.push({ label: d.toLocaleDateString("en-US", { weekday: "short" }), total: Math.round(total), productive: Math.round(productive), nonProductive: Math.round(total - productive) });
      }
      return buckets;
    }

    const buckets = [];
    const selected = new Date(`${selectedDate}T00:00:00`);
    const year = selected.getFullYear();
    const month = selected.getMonth();
    const days = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= days; day++) {
      const date = new Date(year, month, day);
      const key = dateKey(date);
      const rows = currentPeriod.filter((row) => dateKey(row._date) === key);
      const total = rows.reduce((sum, row) => sum + row._duration, 0);
      const productive = rows
        .filter((row) => String(row.productivity || "").toLowerCase() === "productive")
        .reduce((sum, row) => sum + row._duration, 0);
      buckets.push({ label: String(day), total: Math.round(total), productive: Math.round(productive), nonProductive: Math.round(total - productive) });
    }
    return buckets;
  }, [currentPeriod, mode, selectedDate]);

  const periodTitle = selectedDate ? periodLabel(selectedDate, mode) : "Loading...";
  const focusStatus = getFocusStatus(metrics.focusScore);

  return {
    activity,
    loading,
    error,
    mode,
    setMode,
    selectedUser,
    setSelectedUser,
    selectedDate,
    setSelectedDate,
    users,
    userActivity,
    availableDates,
    currentPeriod,
    previousPeriod,
    metrics,
    previousMetrics,
    switchAnalytics,
    previousSwitchAnalytics,
    comparisonMetrics,
    trendData,
    topApplications,
    productivityData,
    timelineData,
    periodTitle,
    focusStatus,
    loadActivity,
  };
}
