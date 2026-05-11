import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  CircleDollarSign,
  Download,
  Landmark,
  Music2,
  RefreshCw,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import PlatformBreakdownChart from "../../components/charts/PlatformBreakdownChart";
import RevenueTrendChart from "../../components/charts/RevenueTrendChart";
import RevenueStatCard from "../../components/revenue/RevenueStatCard";
import Toast from "../../components/ui/Toast";
import { useAuth } from "../../context/useAuth";
import { revenueService } from "../../services/revenueService";
import { formatCurrency, formatNumber } from "../../utils/formatters";
import "./Revenue.css";

const emptyAnalytics = {
  summary: {
    totalGrossRevenue: 0,
    totalNetRevenue: 0,
    totalArtistShare: 0,
    totalLabelShare: 0,
    totalStreams: 0,
    totalTracks: 0,
    totalArtists: 0,
  },
  platformBreakdown: [],
  countryBreakdown: [],
  monthlyTrend: [],
  topTracks: [],
  topArtists: [],
};

const RevenueDashboard = () => {
  const { role } = useAuth();
  const [analytics, setAnalytics] = useState(emptyAnalytics);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [recalculating, setRecalculating] = useState(false);

  const canOperate = role === "admin";
  const canExport = ["admin", "accountant"].includes(role);
  const routeBase =
    {
      admin: "/revenue",
      accountant: "/accountant/revenue",
      artist: "/artist/revenue",
      label: "/label/revenue",
    }[role] || "/revenue";
  const tablePath = `${routeBase}/table`;
  const importsPath = role === "accountant" ? "/accountant/revenue/imports" : "/revenue/imports";

  const stats = useMemo(
    () => [
      {
        title: role === "artist" ? "My Earnings" : "Gross Revenue",
        value: formatCurrency(role === "artist" ? analytics.summary.totalArtistShare : analytics.summary.totalGrossRevenue),
        caption: "Royalty pipeline",
        tone: "cyan",
        icon: TrendingUp,
      },
      {
        title: "Net Revenue",
        value: formatCurrency(analytics.summary.totalNetRevenue),
        caption: "After platform fees",
        tone: "purple",
        icon: CircleDollarSign,
      },
      {
        title: "Streams",
        value: formatNumber(analytics.summary.totalStreams),
        caption: "Normalized plays",
        tone: "magenta",
        icon: Music2,
      },
      {
        title: role === "label" ? "Label Share" : "Tracks Matched",
        value: role === "label" ? formatCurrency(analytics.summary.totalLabelShare) : formatNumber(analytics.summary.totalTracks),
        caption: role === "label" ? "Calculated balance" : "Unique ISRCs",
        tone: "green",
        icon: Landmark,
      },
    ],
    [analytics, role]
  );

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const data = await revenueService.getAnalytics();
      setAnalytics(data);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load revenue analytics." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadAnalytics, 0);
    return () => window.clearTimeout(timer);
  }, [loadAnalytics]);

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      const response = await revenueService.recalculate({});
      setToast({
        type: "success",
        message: `Recalculated ${response.result.recalculatedRows} rows.`,
      });
      loadAnalytics();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Recalculation failed." });
    } finally {
      setRecalculating(false);
    }
  };

  const downloadExport = async () => {
    try {
      const response = await revenueService.exportRevenue("xlsx");
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = "nixa-revenue.xlsx";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Export failed." });
    }
  };

  return (
    <div className="page-stack revenue-workspace">
      <section className="admin-hero revenue-hero">
        <div>
          <p className="eyebrow">Revenue Engine</p>
          <h2>Automated royalty ingestion, normalization and split calculations.</h2>
          <p>Track DSP revenue from CSV import to artist and label shares with clean analytics and exportable statements.</p>
        </div>
        <div className="hero-actions">
          {canOperate ? (
            <Link className="primary-button" to="/revenue/upload">
              <UploadCloud size={17} />
              Upload CSV
            </Link>
          ) : null}
          <Link className="secondary-button" to={tablePath}>
            <BarChart3 size={17} />
            Revenue Table
          </Link>
          {canExport ? (
            <button className="secondary-button" type="button" onClick={downloadExport}>
              <Download size={17} />
              Export
            </button>
          ) : null}
        </div>
      </section>

      {loading ? (
        <section className="stats-grid four-columns">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="metric-card skeleton" key={index} />
          ))}
        </section>
      ) : (
        <section className="stats-grid four-columns">
          {stats.map((item) => (
            <RevenueStatCard key={item.title} {...item} />
          ))}
        </section>
      )}

      <section className="dashboard-grid">
        <article className="panel wide-panel">
          <div className="panel-heading">
            <div>
              <h3>Monthly Royalty Trend</h3>
              <p>Gross revenue against calculated artist share</p>
            </div>
            <span className="period-pill">Latest reports</span>
          </div>
          {analytics.monthlyTrend.length ? (
            <RevenueTrendChart data={analytics.monthlyTrend} />
          ) : (
            <div className="revenue-empty-inline">Upload DSP CSV files to unlock royalty trends.</div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading compact-heading">
            <div>
              <h3>Platform Breakdown</h3>
              <p>DSP contribution and stream mix</p>
            </div>
          </div>
          {analytics.platformBreakdown.length ? (
            <PlatformBreakdownChart data={analytics.platformBreakdown} />
          ) : (
            <div className="revenue-empty-inline compact">No platform revenue yet.</div>
          )}
        </article>
      </section>

      <section className="dashboard-grid lower-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Top Tracks</h3>
              <p>Highest earning ISRCs from normalized reports</p>
            </div>
          </div>
          <div className="rank-list">
            {analytics.topTracks.length ? (
              analytics.topTracks.map((track, index) => (
                <div className="rank-row" key={`${track.isrc}-${track.title}`}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{track.title}</strong>
                    <p>{track.artist || track.isrc}</p>
                  </div>
                  <small>{formatCurrency(track.grossRevenue)}</small>
                </div>
              ))
            ) : (
              <div className="revenue-empty-inline compact">No matched tracks yet.</div>
            )}
          </div>
        </article>

        <article className="panel action-panel">
          <div>
            <RefreshCw size={26} />
            <h3>Calculation Controls</h3>
            <p>Re-run split logic when ISRC matches, artist profiles, labels or split rules change.</p>
          </div>
          <div className="action-list">
            {canOperate ? (
              <button type="button" onClick={handleRecalculate} disabled={recalculating}>
                {recalculating ? "Recalculating..." : "Recalculate Revenue"}
              </button>
            ) : null}
            {["admin", "accountant"].includes(role) ? <Link to={importsPath}>View Import History</Link> : null}
            <Link to={tablePath}>Open Revenue Ledger</Link>
          </div>
        </article>
      </section>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default RevenueDashboard;
