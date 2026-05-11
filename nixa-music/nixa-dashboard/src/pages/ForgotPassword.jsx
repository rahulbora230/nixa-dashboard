import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Send } from "lucide-react";
import BrandMark from "../components/layout/BrandMark";
import { authService } from "../services/authService";
import "./Login.css";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      setLoading(true);
      const result = await authService.forgotPassword(email);
      setMessage(result.resetUrl ? `Reset link generated: ${result.resetUrl}` : "If an account exists, a reset link has been sent.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to start password reset.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-showcase">
        <BrandMark />
        <div>
          <p className="eyebrow">Account Recovery</p>
          <h1>Nixa Music</h1>
          <p>Generate a secure password reset link for your workspace account.</p>
        </div>
      </section>

      <section className="login-card">
        <div className="login-card-header">
          <div className="login-icon"><Mail size={24} /></div>
          <div>
            <p className="eyebrow">Forgot Password</p>
            <h2>Reset access</h2>
          </div>
        </div>
        {error && <div className="login-error">{error}</div>}
        {message && <div className="login-error success-message">{message}</div>}
        <form onSubmit={submit}>
          <label>
            <span>Email</span>
            <div className="input-shell">
              <Mail size={18} />
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@nixamusic.com" required />
            </div>
          </label>
          <button className="primary-button full-width" disabled={loading} type="submit">
            <Send size={18} />
            {loading ? "Sending" : "Send Reset Link"}
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

export default ForgotPassword;
