import { useState } from "react";
import { History, Search } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { financeService } from "../../services/financeService";
import { formatDate } from "../../utils/formatters";
import "./Finance.css";

const SplitHistory = () => {
  const [artistId, setArtistId] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const loadHistory = async () => {
    if (!artistId.trim()) {
      setToast({ type: "error", message: "Enter an artist UUID to view split history." });
      return;
    }

    try {
      setLoading(true);
      const result = await financeService.getSplitHistory(artistId.trim());
      setHistory(result.history || []);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load split history." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-stack finance-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Split History</p>
          <h2>Audit every effective split rule for an artist.</h2>
          <p>Review dated split changes without overwriting historical royalty logic.</p>
        </div>
      </section>

      <section className="statement-toolbar">
        <label className="finance-search span-3">
          <Search size={16} />
          <input value={artistId} onChange={(event) => setArtistId(event.target.value)} placeholder="Artist UUID" />
        </label>
        <button className="primary-button" type="button" onClick={loadHistory} disabled={loading}>
          <History size={17} />
          {loading ? "Loading..." : "Load History"}
        </button>
      </section>

      <section className="catalog-panel finance-table">
        {history.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Artist</th>
                  <th>Track / Release</th>
                  <th>Percentages</th>
                  <th>Effective</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {history.map((split) => (
                  <tr key={split.id}>
                    <td>{split.splitType}</td>
                    <td>{split.artistName || split.artistId}</td>
                    <td>{split.trackTitle || split.releaseTitle || split.isrc || "-"}</td>
                    <td>
                      <div className="split-percent">
                        <span>A {split.artistPercentage}%</span>
                        <span>L {split.labelPercentage}%</span>
                        <span>C {split.companyPercentage}%</span>
                      </div>
                    </td>
                    <td>
                      {formatDate(split.effectiveFrom)} to {split.effectiveTo ? formatDate(split.effectiveTo) : "Open"}
                    </td>
                    <td>
                      <span className={`finance-badge ${split.status}`}>{split.status}</span>
                    </td>
                    <td>{split.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="finance-empty">{loading ? "Loading split history..." : "Enter an artist UUID to view split history."}</div>
        )}
      </section>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default SplitHistory;
