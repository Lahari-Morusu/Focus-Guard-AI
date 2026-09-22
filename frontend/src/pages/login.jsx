import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api";
import "./login.css";
import { FaEye, FaEyeSlash } from "react-icons/fa";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loginUser = async (e) => {
    e.preventDefault();

    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      const res = await API.post("/login", {
        username_or_email: email.trim(),
        password,
      });

      if (res.status === 200) {
        const user = res.data.user;

        localStorage.setItem("token", res.data.token || "");
        localStorage.setItem("isLoggedIn", "true");

        if (user) {
          localStorage.setItem("user", JSON.stringify(user));
          localStorage.setItem("email", user.email || "");
          localStorage.setItem(
            "username",
            `${user.firstName || ""} ${user.lastName || ""}`.trim()
          );
        }

        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Login error:", err);

      if (err.response) {
        setError(
          err.response.data?.error ||
          err.response.data?.message ||
          "Invalid email or password."
        );
      } else {
        setError(
          "Unable to connect to the server. Please make sure the backend is running."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">

        <div className="login-brand">
          <div className="brand-mark">FG</div>

          <div>
            <h2>Focus Guard AI</h2>
            <span>Productivity Intelligence</span>
          </div>
        </div>

        <div className="login-header">
          <h1>Welcome back</h1>
          <p>Sign in to continue to your productivity dashboard.</p>
        </div>

        {error && (
          <div className="login-error">
            {error}
          </div>
        )}

        <form onSubmit={loginUser}>

          <div className="form-group">
            <label>Email address</label>

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <div className="password-label-row">
              <label>Password</label>

              <a href="#" onClick={(e) => e.preventDefault()}>
                Forgot password?
              </a>
            </div>

            <div className="password-container">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />

              <button
                type="button"
                className="eye-icon"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <label className="remember-me">
            <input type="checkbox" />
            <span>Remember me</span>
          </label>

          <button
            type="submit"
            className="login-btn"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

        </form>

        <div className="login-divider">
          <span>OR</span>
        </div>

        <p className="bottom-text">
          Don't have an account?{" "}
          <Link to="/register">Create an account</Link>
        </p>

        <p className="login-footer">
          Secure productivity analytics powered by Focus Guard AI
        </p>

      </div>
    </div>
  );
}

export default Login;