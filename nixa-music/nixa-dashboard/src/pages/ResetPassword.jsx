import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, LockKeyhole, Save } from "lucide-react";
import BrandMark from "../components/layout/BrandMark";
import { authService } from "../services/authService";
import "./Login.css";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      await authService.resetPassword({ token, password });
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-showcase">
        <BrandMark />
        <div>
          <p className="eyebrow">Secure Reset</p>
          <h1>Nixa Music</h1>
          <p>Choose a strong password with uppercase, lowercase and number characters.</p>
        </div>
      </section>

      <section className="login-card">
        <div className="login-card-header">
          <div className="login-icon"><LockKeyhole size={24} /></div>
          <div>
            <p className="eyebrow">Reset Password</p>
            <h2>Set new password</h2>
          </div>
        </div>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={submit}>
          <label>
            <span>New password</span>
            <div className="input-shell">
              <LockKeyhole size={18} />
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
          </label>
          <label>
            <span>Confirm password</span>
            <div className="input-shell">
              <LockKeyhole size={18} />
              <input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
            </div>
          </label>
          <button className="primary-button full-width" disabled={loading || !token} type="submit">
            <Save size={18} />
            {loading ? "Saving" : "Reset Password"}
          </button>
          <Link className="secondary-button full-width" to="/login">
            <ArrowLeft size={18} />
            Back to Login
          </Link>
        </form>
      </section>
    </div>
  );
};

export default ResetPassword;
