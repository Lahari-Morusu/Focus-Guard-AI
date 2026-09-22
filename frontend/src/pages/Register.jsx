import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api";
import "./Register.css";

function Register() {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const passwordRules = {
    length: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  };

  const isPasswordValid =
    passwordRules.length &&
    passwordRules.uppercase &&
    passwordRules.number &&
    passwordRules.special;

  const registerUser = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter your first and last name.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!isPasswordValid) {
      setError(
        "Password must contain at least 6 characters, one uppercase letter, one number, and one special character."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const response = await API.post("/register", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
      });

      setSuccess(
        response.data.message ||
          "Registration successful. You can now log in."
      );

      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err) {
      console.error("Registration error:", err);

      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.code === "ERR_NETWORK") {
        setError(
          "Unable to connect to the server. Please make sure the backend is running."
        );
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">

      <div className="register-background">
        <div className="background-glow glow-one"></div>
        <div className="background-glow glow-two"></div>
      </div>

      <div className="register-wrapper">

        <div className="register-brand">
          <div className="brand-icon">
            FG
          </div>

          <h2>Focus Guard AI</h2>

          <p>
            Intelligent productivity analytics
            <br />
            designed for focused work.
          </p>
        </div>

        <div className="register-card">

          <div className="register-header">
            <span className="eyebrow">GET STARTED</span>

            <h1>Create your account</h1>

            <p>
              Start understanding your focus and productivity.
            </p>
          </div>

          {error && (
            <div className="message error-message">
              <span>!</span>
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="message success-message">
              <span>✓</span>
              <p>{success}</p>
            </div>
          )}

          <form onSubmit={registerUser}>

            <div className="name-row">

              <div className="form-group">
                <label>First name</label>

                <input
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </div>

              <div className="form-group">
                <label>Last name</label>

                <input
                  type="text"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>

            </div>

            <div className="form-group">

              <label>Email address</label>

              <div className="input-wrapper">

                <span className="input-icon">
                  @
                </span>

                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />

              </div>

            </div>

            <div className="form-group">

              <label>Password</label>

              <div className="input-wrapper">

                <span className="input-icon">
                  •
                </span>

                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>

              </div>

            </div>

            <div className="password-rules">

              <span className={passwordRules.length ? "valid" : ""}>
                {passwordRules.length ? "✓" : "○"} 6+ characters
              </span>

              <span className={passwordRules.uppercase ? "valid" : ""}>
                {passwordRules.uppercase ? "✓" : "○"} Uppercase
              </span>

              <span className={passwordRules.number ? "valid" : ""}>
                {passwordRules.number ? "✓" : "○"} Number
              </span>

              <span className={passwordRules.special ? "valid" : ""}>
                {passwordRules.special ? "✓" : "○"} Special character
              </span>

            </div>

            <div className="form-group">

              <label>Confirm password</label>

              <div className="input-wrapper">

                <span className="input-icon">
                  •
                </span>

                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>

              </div>

              {confirmPassword && (
                <div
                  className={
                    password === confirmPassword
                      ? "password-match valid"
                      : "password-match invalid"
                  }
                >
                  {password === confirmPassword
                    ? "✓ Passwords match"
                    : "Passwords do not match"}
                </div>
              )}

            </div>

            <button
              type="submit"
              className="register-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Creating account...
                </>
              ) : (
                <>
                  Create account
                  <span>→</span>
                </>
              )}
            </button>

          </form>

          <div className="login-link">
            Already have an account?
            <Link to="/">
              Sign in
            </Link>
          </div>

        </div>

      </div>

    </div>
  );
}

export default Register;