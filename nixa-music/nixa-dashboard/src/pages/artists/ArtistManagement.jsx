import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, RefreshCw, Search, UserRound } from "lucide-react";
import Toast from "../../components/ui/Toast";
import { artistService } from "../../services/artistService";
import { formatCurrency, formatDate, formatNumber } from "../../utils/formatters";
import "../management/Management.css";

const ArtistManagement = () => {
  const [filters, setFilters] = useState({ search: "", status: "", sort: "created", page: 1, limit: 12 });
  const [data, setData] = useState({ artists: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const loadArtists = useCallback(async () => {
    try {
      setLoading(true);
      const result = await artistService.getArtists(filters);
      setData(result);
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load artists." });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(loadArtists, 0);
    return () => window.clearTimeout(timer);
  }, [loadArtists]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? value : 1 }));
  };

  const toggleStatus = async (artist) => {
    try {
      const nextStatus = artist.status === "active" ? "disabled" : "active";
      await artistService.updateStatus(artist.id, nextStatus);
      setToast({ type: "success", message: `Artist ${nextStatus === "active" ? "enabled" : "disabled"}.` });
      loadArtists();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to update artist." });
    }
  };

  return (
    <div className="page-stack management-workspace">
      <section className="admin-hero compact-hero">
        <div>
          <p className="eyebrow">Artist Management</p>
          <h2>Create artist profiles, assign labels and keep finance details ready.</h2>
          <p>Manage legal, tax, bank and roster information for every artist account.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" type="button" onClick={loadArtists}>
            <RefreshCw size={17} />
            Refresh
          </button>
          <Link className="primary-button" to="/admin/artists/new">
            <Plus size={17} />
            Create Artist
          </Link>
        </div>
      </section>

      <section className="management-toolbar">
        <label className="management-search span-2">
          <Search size={16} />
          <input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Search artist, legal name, email, country" />
        </label>
        <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
          <option value="pending">Pending</option>
        </select>
        <select value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)}>
          <option value="created">Newest</option>
          <option value="name">Artist name</option>
          <option value="revenue">Revenue</option>
          <option value="payable">Payable</option>
          <option value="status">Status</option>
        </select>
      </section>

      <section className="catalog-panel management-table">
        {loading ? (
          <div className="catalog-skeleton revenue-skeleton-wrap">
            {Array.from({ length: 7 }).map((_, index) => <div className="catalog-skeleton-row skeleton" key={index} />)}
          </div>
        ) : data.artists.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Artist</th>
                  <th>Label</th>
                  <th>Revenue</th>
                  <th>Payable</th>
                  <th>Streams</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.artists.map((artist) => (
                  <tr key={artist.id}>
                    <td>
                      <strong>{artist.artistName}</strong>
                      <div>{artist.email || artist.userEmail || "No email"}</div>
                    </td>
                    <td>{artist.labelName || "Independent"}</td>
                    <td>{formatCurrency(artist.grossRevenue)}</td>
                    <td>{formatCurrency(artist.pendingAmount || artist.payableBalance)}</td>
                    <td>{formatNumber(artist.totalStreams)}</td>
                    <td><span className={`management-badge ${artist.status}`}>{artist.status}</span></td>
                    <td>{formatDate(artist.createdAt)}</td>
                    <td>
                      <div className="management-actions">
                        <Link to={`/admin/artists/${artist.id}`}>
                          <UserRound size={14} />
                          Details
                        </Link>
                        <button type="button" onClick={() => toggleStatus(artist)}>
                          {artist.status === "active" ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="management-empty">No artists match the selected filters.</div>
        )}
      </section>

      <div className="pagination-row">
        <button className="secondary-button" type="button" disabled={filters.page <= 1} onClick={() => updateFilter("page", filters.page - 1)}>Previous</button>
        <span>Page {data.pagination.page} of {data.pagination.totalPages}</span>
        <button className="secondary-button" type="button" disabled={filters.page >= data.pagination.totalPages} onClick={() => updateFilter("page", filters.page + 1)}>Next</button>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default ArtistManagement;
