import { useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "./DashboardLayout";
import { useProductivityData, formatMinutes } from "./dashboardData";

const averagePoint = (a, b) => [
  (Number(a[0]) + Number(b[0])) / 2,
  (Number(a[1]) + Number(b[1])) / 2,
];

// --- tuning knobs ---
const LOOK_AWAY_THRESHOLD = 0.17;      // head-turn ratio that counts as "looking away"
const MOVEMENT_THRESHOLD = 8;          // movement score that counts as "excessive motion"
const DISTRACTION_DEBOUNCE_MS = 1500;  // must be distracted this long before warning
const BREAK_INTERVAL_SECONDS = 1800;   // suggest a break every 30 min of session time (set lower to test, e.g. 60)

export default function GoalsPage() {
  const { activity, loading, error, mode, setMode, selectedUser, setSelectedUser, selectedDate, setSelectedDate, users, availableDates, metrics, periodTitle, loadActivity } = useProductivityData();
  const [goals, setGoals] = useState([]);
  const [title, setTitle] = useState("Code for 1 hour today");
  const [targetMinutes, setTargetMinutes] = useState(60);
  const [targetDate, setTargetDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [goalError, setGoalError] = useState("");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const lastNoseRef = useRef(null);
  const lastAlertAtRef = useRef(0);
  const missedFrameCountRef = useRef(0);
  const distractedSinceRef = useRef(null); // debounce timer for "looking away"/"moving"

  const [sessionState, setSessionState] = useState({
    title: "Code for 1 hour",
    targetMinutes: 60,
    started: false,
    elapsedSeconds: 0,
    breakReminder: "",
    breakCount: 0,
    alertText: "Camera is idle",
    alertTone: "neutral",
  });
  const [cameraState, setCameraState] = useState("Camera not started");
  const [faceMetrics, setFaceMetrics] = useState({ headTurn: 0, movement: 0 });

  async function fetchGoals() {
    try {
      const response = await fetch(`/api/goals?user=${encodeURIComponent(selectedUser)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load goals.");
      setGoals(data.goals || []);
    } catch (error) {
      setGoalError(error.message);
    }
  }

  useEffect(() => {
    fetchGoals();
  }, [selectedUser]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (landmarkerRef.current) {
        landmarkerRef.current.close?.();
      }
    };
  }, []);

  const dateProgress = useMemo(() => {
    const target = new Date(`${targetDate}T00:00:00`);
    const rows = activity.filter((row) => row.user_type === selectedUser && row.opened_date && new Date(row.opened_date).toDateString() === target.toDateString());
    const totalMinutes = rows.reduce((sum, row) => sum + Number(row.duration_minutes || 0), 0);
    const productiveMinutes = rows.filter((row) => String(row.productivity || "").toLowerCase() === "productive").reduce((sum, row) => sum + Number(row.duration_minutes || 0), 0);
    return {
      totalMinutes,
      productiveMinutes,
      progressPercent: targetMinutes > 0 ? (productiveMinutes / targetMinutes) * 100 : 0,
    };
  }, [activity, selectedUser, targetDate, targetMinutes]);

  const sessionProgress = useMemo(() => {
    if (!sessionState.started || !sessionState.targetMinutes) return 0;
    const totalSeconds = Number(sessionState.targetMinutes) * 60;
    return Math.min(100, (sessionState.elapsedSeconds / totalSeconds) * 100);
  }, [sessionState.elapsedSeconds, sessionState.started, sessionState.targetMinutes]);

  const handleLandmarkUpdate = (results) => {
    // FIX: MediaPipe FaceLandmarker returns "faceLandmarks", not "landmarks".
    // "landmarks" is undefined here, which was making this always look like "no face".
    if (!results || !results.faceLandmarks || results.faceLandmarks.length === 0) {
      const missedFrames = (missedFrameCountRef.current || 0) + 1;
      missedFrameCountRef.current = missedFrames;
      distractedSinceRef.current = null;

      if (missedFrames < 8) {
        setSessionState((prev) => ({
          ...prev,
          alertText: prev.started ? "Checking face..." : "Camera ready",
          alertTone: "neutral",
        }));
        setFaceMetrics((prev) => ({ ...prev, movement: 0 }));
        return;
      }

      setSessionState((prev) => ({
        ...prev,
        alertText: prev.started ? "No face detected. Please face the camera." : "Camera is ready",
        alertTone: "danger",
      }));
      setFaceMetrics({ headTurn: 0, movement: 0 });
      return;
    }

    missedFrameCountRef.current = 0;

    const landmarks = results.faceLandmarks[0];
    const leftEye = averagePoint(landmarks[33], landmarks[133]);
    const rightEye = averagePoint(landmarks[263], landmarks[362]);
    const nose = landmarks[1];
    const faceCenterX = (leftEye[0] + rightEye[0]) / 2;
    const faceWidth = Math.abs(landmarks[234][0] - landmarks[454][0]) || 1;
    const chin = landmarks[152];
    const faceHeight = Math.abs(chin[1] - nose[1]) || 1;

    const headTurn = (nose[0] - faceCenterX) / faceWidth;
    const movement = lastNoseRef.current
      ? Math.hypot(nose[0] - lastNoseRef.current[0], nose[1] - lastNoseRef.current[1]) * 100 / faceHeight
      : 0;

    lastNoseRef.current = nose;
    setFaceMetrics({ headTurn: Number(headTurn.toFixed(3)), movement: Number(movement.toFixed(3)) });

    setSessionState((prev) => {
      if (!prev.started) {
        distractedSinceRef.current = null;
        return { ...prev, alertText: "Camera ready", alertTone: "neutral" };
      }

      const lookingAway = Math.abs(headTurn) > LOOK_AWAY_THRESHOLD;
      const excessiveMotion = movement > MOVEMENT_THRESHOLD;
      const isDistracted = lookingAway || excessiveMotion;

      // Debounce: require the distraction to persist briefly before warning,
      // so a quick glance or a blink doesn't trigger a false alert.
      const now = Date.now();
      if (isDistracted) {
        distractedSinceRef.current ??= now;
      } else {
        distractedSinceRef.current = null;
      }

      const shouldWarn = isDistracted && now - (distractedSinceRef.current || now) > DISTRACTION_DEBOUNCE_MS;

      const nextAlert = shouldWarn ? "Concentrate on your work" : "Focused and steady";
      const nextTone = shouldWarn ? "warning" : "success";

      if (shouldWarn) {
        lastAlertAtRef.current = now;
      }

      return {
        ...prev,
        alertText: nextAlert,
        alertTone: nextTone,
      };
    });
  };

  const detectFaces = () => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker) return;

    cancelAnimationFrame(rafRef.current); // avoid stacking multiple loops (e.g. React Strict Mode double-invoke)
    let lastTimestamp = -1;

    const tick = () => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const timestamp = performance.now();
        if (timestamp > lastTimestamp) {
          lastTimestamp = timestamp;
          const results = landmarker.detectForVideo(video, timestamp);
          handleLandmarkUpdate(results);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  async function initializeCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraState("Camera not supported on this browser");
      return false;
    }

    try {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      streamRef.current = stream;
      setCameraState("Camera live");

      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
      let delegate = "GPU";

      try {
        landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate,
          },
          runningMode: "VIDEO",
          numFaces: 1,
        });
      } catch (gpuError) {
        landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
        });
      }

      setSessionState((prev) => ({
        ...prev,
        alertText: prev.started ? "Tracking focus..." : "Camera ready",
        alertTone: prev.started ? "neutral" : "neutral",
      }));

      detectFaces();
      return true;
    } catch (error) {
      setCameraState("Camera access needed to track focus");
      setSessionState((prev) => ({
        ...prev,
        alertText: "Camera permission required",
        alertTone: "danger",
      }));
      return false;
    }
  }

  useEffect(() => {
    if (!sessionState.started) return undefined;

    const timer = window.setInterval(() => {
      setSessionState((prev) => {
        if (!prev.started) return prev;

        const nextElapsed = prev.elapsedSeconds + 1;
        const nextBreakCount = Math.floor(nextElapsed / BREAK_INTERVAL_SECONDS);
        const nextBreakReminder = nextBreakCount > prev.breakCount
          ? "Great work! Take a 3-5 minute break to reset."
          : prev.breakReminder;

        return {
          ...prev,
          elapsedSeconds: nextElapsed,
          breakCount: nextBreakCount,
          breakReminder: nextBreakReminder,
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [sessionState.started]);

  async function handleStartSession() {
    const minutes = Number(targetMinutes);
    const finalTitle = title.trim() || "Code for 1 hour";

    if (!Number.isFinite(minutes) || minutes < 15) {
      setGoalError("Set a goal of at least 15 minutes to start the focus session.");
      return;
    }

    setGoalError("");
    distractedSinceRef.current = null;
    setSessionState({
      title: finalTitle,
      targetMinutes: minutes,
      started: true,
      elapsedSeconds: 0,
      breakReminder: "",
      breakCount: 0,
      alertText: "Starting camera focus tracking...",
      alertTone: "neutral",
    });

    const started = await initializeCamera();
    if (!started) {
      setSessionState((prev) => ({
        ...prev,
        started: false,
        alertText: "Camera permission required",
      }));
    }
  }

  function handleStopSession() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    landmarkerRef.current = null;
    lastNoseRef.current = null;
    distractedSinceRef.current = null;
    missedFrameCountRef.current = 0;
    setCameraState("Camera stopped");
    setSessionState((prev) => ({
      ...prev,
      started: false,
      alertText: "Session ended",
      alertTone: "neutral",
    }));
  }

  async function handleCreateGoal(event) {
    event.preventDefault();
    setGoalError("");
    const minutes = Number(targetMinutes);
    if (!title.trim() || !Number.isFinite(minutes) || minutes < 15 || !targetDate) {
      setGoalError("Enter a title, a target of at least 15 minutes, and a target date.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: selectedUser, title: title.trim(), targetMinutes: minutes, targetDate }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create goal.");
      setTitle("Code for 1 hour today");
      setTargetMinutes(60);
      setTargetDate(new Date().toISOString().slice(0, 10));
      await fetchGoals();
    } catch (error) {
      setGoalError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGoal(goalId) {
    await fetch(`/api/goals/${goalId}`, { method: "DELETE" });
    fetchGoals();
  }

  return (
    <DashboardLayout
      title="Goals"
      subtitle={`Create and track goals for ${selectedUser}.`}
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
      currentPage="goals"
    >
      <div className="goals-grid">
        <div className="panel">
          <div className="panel-header"><div><h2>Create Goal</h2><p>Set a user-specific target</p></div></div>
          <form className="goal-form" onSubmit={handleCreateGoal}>
            <label>
              Goal Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Code for 1 hour today" />
            </label>
            <div className="goal-inline">
              <label>
                Target minutes
                <input type="number" min="15" step="15" value={targetMinutes} onChange={(e) => setTargetMinutes(e.target.value)} />
              </label>
              <label>
                Target date
                <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
              </label>
            </div>
            <button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving..." : "Save Goal"}</button>
            {goalError && <div className="form-error" role="alert">{goalError}</div>}
          </form>

          <div className="goal-progress-box">
            <div className="goal-progress-header">
              <span>Current progress preview</span>
              <strong>{Math.min(100, Number(dateProgress.progressPercent || 0)).toFixed(0)}%</strong>
            </div>
            <div className="progress-bar"><span style={{ width: `${Math.min(100, Number(dateProgress.progressPercent || 0))}%` }} /></div>
            <small>{formatMinutes(dateProgress.productiveMinutes)} of {formatMinutes(Number(targetMinutes))} productive minutes on {targetDate}</small>
          </div>

          <div className="focus-session-block">
            <div className="panel-header"><div><h2>Camera Focus & Goal</h2><p>Local webcam tracking</p></div></div>
            <div className="focus-session-inner">
              <div className="focus-session-header">
                <div>
                  <span className="focus-kicker">ACTIVE GOAL</span>
                  <strong>{sessionState.title}</strong>
                </div>
                <span className={`focus-badge focus-badge-${sessionState.alertTone}`}>{sessionState.alertText}</span>
              </div>

              <div className="camera-stage">
                <video ref={videoRef} className="camera-video" autoPlay muted playsInline />
                {!sessionState.started && <div className="camera-overlay">Camera paused</div>}
              </div>

              <div className="focus-metrics-grid">
                <div>
                  <span>Elapsed</span>
                  <strong>{formatMinutes(Math.floor(sessionState.elapsedSeconds / 60))}</strong>
                </div>
                <div>
                  <span>Goal</span>
                  <strong>{sessionState.targetMinutes} min</strong>
                </div>
                <div>
                  <span>Head movement</span>
                  <strong>{Math.abs(faceMetrics.headTurn).toFixed(2)}</strong>
                </div>
              </div>

              <div className="progress-bar focus-progress"><span style={{ width: `${sessionProgress}%` }} /></div>

              {sessionState.alertTone === "warning" && (
                <div className="focus-alert warning-alert">{sessionState.alertText}</div>
              )}

              {sessionState.breakReminder && (
                <div className="focus-alert break-alert">{sessionState.breakReminder}</div>
              )}

              <div className="camera-actions">
                {sessionState.started ? (
                  <button type="button" className="primary-button" onClick={handleStopSession}>End Session</button>
                ) : (
                  <button type="button" className="primary-button" onClick={handleStartSession}>Start Session</button>
                )}
                <button type="button" className="ghost-button" onClick={initializeCamera}>Enable Camera</button>
              </div>

              <small className="camera-note">{cameraState}. Video stays on this device and is never uploaded or stored.</small>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><div><h2>Saved Goals</h2><p>{goals.length} active goal(s)</p></div></div>
          <div className="goal-list">
            {goals.length === 0 ? (
              <div className="empty-state">No goals saved yet for this user.</div>
            ) : (
              goals.map((goal) => {
                const goalDate = new Date(`${goal.target_date}T00:00:00`);
                const rows = activity.filter((row) => row.user_type === selectedUser && row.opened_date && new Date(row.opened_date).toDateString() === goalDate.toDateString());
                const productiveMinutes = rows.filter((row) => String(row.productivity || "").toLowerCase() === "productive").reduce((sum, row) => sum + Number(row.duration_minutes || 0), 0);
                const percent = goal.target_minutes > 0 ? (productiveMinutes / goal.target_minutes) * 100 : 0;
                return (
                  <div className="goal-item" key={goal.id}>
                    <div className="goal-top-row">
                      <strong>{goal.title}</strong>
                      <button type="button" className="ghost-button" onClick={() => handleDeleteGoal(goal.id)}>Delete</button>
                    </div>
                    <div className="goal-meta">{new Date(goal.target_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} • {goal.target_minutes} min target</div>
                    <div className="progress-bar"><span style={{ width: `${Math.min(100, percent)}%` }} /></div>
                    <div className="goal-meta">{formatMinutes(productiveMinutes)} complete • {Math.min(100, percent).toFixed(0)}%</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}