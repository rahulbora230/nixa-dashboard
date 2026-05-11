import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import BrandMark from "../components/layout/BrandMark";
import { useAuth } from "../context/useAuth";
import "./Login.css";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);

      const data = await login(form);
      navigate(data.homePath, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-showcase">
        <BrandMark />
        <div>
          <p className="eyebrow">Premium music distribution SaaS</p>
          <h1>Nixa Music</h1>
          <p>
            Revenue accounting, release control and payout operations for artists, labels and finance teams.
          </p>
        </div>
        <div className="login-signal-grid">
          <div>
            <span>Total Revenue</span>
            <strong>INR 48.2L</strong>
          </div>
          <div>
            <span>Streams</span>
            <strong>28.4M</strong>
          </div>
          <div>
            <span>Pending Payouts</span>
            <strong>31</strong>
          </div>
        </div>
      </section>

      <section className="login-card">
        <div className="login-card-header">
          <div className="login-icon">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="eyebrow">Secure Access</p>
            <h2>Sign in</h2>
          </div>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleLogin}>
          <label>
            <span>Email</span>
            <div className="input-shell">
              <Mail size={18} />
              <input
                type="email"
                name="email"
                placeholder="admin@nixamusic.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </div>
          </label>

          <label>
            <span>Password</span>
            <div className="input-shell">
              <LockKeyhole size={18} />
              <input
                type="password"
                name="password"
                placeholder="Enter password"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
                required
              />
            </div>
          </label>

          <button className="primary-button full-width" disabled={loading} type="submit">
            {loading ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
            {loading ? "Signing in" : "Enter Dashboard"}
            {!loading && <ArrowRight size={18} />}
          </button>
          <Link className="secondary-button full-width" to="/forgot-password">Forgot password</Link>
        </form>

        <p className="login-footnote">Protected by JWT authentication and role-based access.</p>
      </section>
    </div>
  );
};

export default Login;
