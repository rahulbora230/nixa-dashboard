import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Toast from "../../components/ui/Toast";
import { settingsService } from "../../services/settingsService";
import "../management/Management.css";

const defaults = {
  company_name: "Nixa Music",
  default_artist_split: 80,
  minimum_payout_threshold: 1000,
  gst_percentage: 0,
  tds_percentage: 10,
  default_currency: "INR",
  platforms: ["Spotify", "Apple Music", "YouTube", "JioSaavn", "Wynk", "Meta"],
  metadata_formats: {
    default_format: "auto",
    formats: {
      v1: {
        key: "v1",
        label: "Metadata V1",
        enabled: true,
        required_fields: ["release_title", "track_title", "primary_artist", "label_name", "genre", "language"],
        optional_fields: ["upc", "isrc", "composer", "lyricist", "producer", "publisher", "release_date"],
      },
      v2: {
        key: "v2",
        label: "Metadata V2",
        enabled: true,
        required_fields: ["release_title", "track_title", "primary_artist", "label_name", "genre", "language"],
        optional_fields: ["upc", "isrc", "iswc", "subgenre", "mood", "composer", "lyricist", "producer", "publisher", "release_date", "go_live_date"],
      },
    },
    aliases: {},
  },
};

const settingsToForm = (settings = []) => {
  const form = { ...defaults };
  settings.forEach((item) => {
    form[item.key] = item.value;
  });
  return form;
};

const AdminSettings = () => {
  const [form, setForm] = useState(defaults);
  const [smtp, setSmtp] = useState({ configured: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [aliasDraft, setAliasDraft] = useState("{}");

  const platformText = useMemo(() => (Array.isArray(form.platforms) ? form.platforms.join(", ") : String(form.platforms || "")), [form.platforms]);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const result = await settingsService.getSettings();
      const nextForm = settingsToForm(result.settings);
      setForm(nextForm);
      setAliasDraft(JSON.stringify(nextForm.metadata_formats?.aliases || {}, null, 2));
      setSmtp(result.smtp || { configured: false });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to load settings." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadSettings, 0);
    return () => window.clearTimeout(timer);
  }, [loadSettings]);

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateMetadataFormat = (formatKey, key, value) => {
    setForm((current) => ({
      ...current,
      metadata_formats: {
        ...(current.metadata_formats || defaults.metadata_formats),
        formats: {
          ...((current.metadata_formats || defaults.metadata_formats).formats || {}),
          [formatKey]: {
            ...((current.metadata_formats || defaults.metadata_formats).formats?.[formatKey] || {}),
            [key]: value,
          },
        },
      },
    }));
  };

  const updateMetadataDefaults = (key, value) => {
    setForm((current) => ({
      ...current,
      metadata_formats: {
        ...(current.metadata_formats || defaults.metadata_formats),
        [key]: value,
      },
    }));
  };

  const submitSettings = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      const payload = {
        ...form,
        default_artist_split: Number(form.default_artist_split),
        minimum_payout_threshold: Number(form.minimum_payout_threshold),
        gst_percentage: Number(form.gst_percentage),
        tds_percentage: Number(form.tds_percentage),
        platforms: platformText.split(",").map((item) => item.trim()).filter(Boolean),
        metadata_formats: {
          ...(form.metadata_formats || defaults.metadata_formats),
          aliases: JSON.parse(aliasDraft || "{}"),
        },
      };
      const result = await settingsService.updateSettings(payload);
      setForm(settingsToForm(result.settings));
      setSmtp(result.smtp || smtp);
      setToast({ type: "success", message: "Settings updated." });
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Unable to update settings." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack management-workspace">
      <PageHeader
        eyebrow="Admin Settings"
        title="Production defaults for finance, payout and platform operations."
        description={smtp.configured ? `SMTP configured via ${smtp.host}` : "SMTP is not configured yet."}
        actions={(
          <button className="secondary-button" type="button" onClick={loadSettings}>
            <RefreshCw size={17} />
            Refresh
          </button>
        )}
      />

      <form className="management-form" onSubmit={submitSettings}>
        <input value={form.company_name} onChange={(event) => updateForm("company_name", event.target.value)} placeholder="Company name" />
        <input type="number" value={form.default_artist_split} onChange={(event) => updateForm("default_artist_split", event.target.value)} placeholder="Default artist split" />
        <input type="number" value={form.minimum_payout_threshold} onChange={(event) => updateForm("minimum_payout_threshold", event.target.value)} placeholder="Minimum payout threshold" />
        <input type="number" value={form.gst_percentage} onChange={(event) => updateForm("gst_percentage", event.target.value)} placeholder="GST percentage" />
        <input type="number" value={form.tds_percentage} onChange={(event) => updateForm("tds_percentage", event.target.value)} placeholder="TDS percentage" />
        <input value={form.default_currency} onChange={(event) => updateForm("default_currency", event.target.value)} placeholder="Default currency" />
        <textarea className="span-6" value={platformText} onChange={(event) => updateForm("platforms", event.target.value)} placeholder="Platforms, comma separated" />
        <div className="span-6 management-subsection">
          <h3>Metadata Upload Formats</h3>
          <p>Control which templates users can download and which fields are required during V1/V2 upload validation.</p>
        </div>
        <select
          value={form.metadata_formats?.default_format || "auto"}
          onChange={(event) => updateMetadataDefaults("default_format", event.target.value)}
        >
          <option value="auto">Auto Detect</option>
          <option value="v1">Metadata V1</option>
          <option value="v2">Metadata V2</option>
        </select>
        {["v1", "v2"].map((formatKey) => {
          const format = form.metadata_formats?.formats?.[formatKey] || defaults.metadata_formats.formats[formatKey];
          return (
            <div className="span-6 metadata-format-admin" key={formatKey}>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={format.enabled !== false}
                  onChange={(event) => updateMetadataFormat(formatKey, "enabled", event.target.checked)}
                />
                <span>{formatKey.toUpperCase()} enabled</span>
              </label>
              <input
                value={format.label || ""}
                onChange={(event) => updateMetadataFormat(formatKey, "label", event.target.value)}
                placeholder={`${formatKey.toUpperCase()} label`}
              />
              <textarea
                value={(format.required_fields || []).join(", ")}
                onChange={(event) =>
                  updateMetadataFormat(
                    formatKey,
                    "required_fields",
                    event.target.value.split(",").map((item) => item.trim()).filter(Boolean)
                  )
                }
                placeholder="Required fields, comma separated"
              />
              <textarea
                value={(format.optional_fields || []).join(", ")}
                onChange={(event) =>
                  updateMetadataFormat(
                    formatKey,
                    "optional_fields",
                    event.target.value.split(",").map((item) => item.trim()).filter(Boolean)
                  )
                }
                placeholder="Optional fields, comma separated"
              />
            </div>
          );
        })}
        <textarea
          className="span-6"
          value={aliasDraft}
          onChange={(event) => setAliasDraft(event.target.value)}
          placeholder='Header aliases JSON, for example { "release_title": ["Film /Album Name"] }'
          rows={6}
        />
        <button className="primary-button" type="submit" disabled={saving || loading}>
          <Save size={17} />
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </form>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};

export default AdminSettings;
