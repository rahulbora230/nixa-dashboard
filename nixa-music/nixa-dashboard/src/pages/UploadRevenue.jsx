import React, { useState } from "react";

const UploadRevenue = () => {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔥 CSV Preview Parser (frontend)
  const parseCSV = (text) => {
    const lines = text.split("\n").filter((l) => l.trim() !== "");
    const headers = lines[0].split(",");
    const data = lines.slice(1).map((line) => {
      const values = line.split(",");
      let obj = {};
      headers.forEach((h, i) => (obj[h.trim()] = values[i]));
      return obj;
    });
    return data;
  };

  // 🔥 Basic validation
  const validateData = (data) => {
    let errs = [];
    data.forEach((row, i) => {
      if (!row.track_name || !row.revenue) {
        errs.push(`Row ${i + 1} missing required fields`);
      }
    });
    return errs;
  };

  // 🔥 File select
  const handleFile = (f) => {
    setFile(f);
    setStatus("");
    setErrors([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCSV(e.target.result);
      setRows(parsed);

      const validationErrors = validateData(parsed);
      setErrors(validationErrors);
    };
    reader.readAsText(f);
  };

  // 🔥 Upload
  const handleUpload = async () => {
    if (!file) return alert("Select CSV first");
    if (errors.length > 0) return alert("Fix errors first");

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      setStatus("Uploading...");

      const res = await fetch("http://localhost:5000/api/revenue/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      setStatus(`✅ Uploaded ${data.inserted || 0} rows`);
      setRows([]);
      setFile(null);

    } catch (err) {
      console.error(err);
      setStatus("❌ Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 30, color: "white", background: "#0B0F14", minHeight: "100vh" }}>
      
      <h2 style={{ marginBottom: 20 }}>Upload Revenue CSV</h2>

      {/* Upload Card */}
      <div style={{
        background: "#161C23",
        padding: 20,
        borderRadius: 12,
        marginBottom: 20
      }}>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => handleFile(e.target.files[0])}
        />

        <button
          onClick={handleUpload}
          disabled={loading}
          style={{
            marginLeft: 10,
            padding: "8px 16px",
            background: "#00FFAA",
            border: "none",
            borderRadius: 6,
            cursor: "pointer"
          }}
        >
          {loading ? "Uploading..." : "Upload"}
        </button>

        <p style={{ marginTop: 10 }}>{status}</p>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div style={{
          background: "#2A1A1A",
          padding: 15,
          borderRadius: 10,
          marginBottom: 20
        }}>
          <h4 style={{ color: "#FF4D4F" }}>Errors:</h4>
          <ul>
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview Table */}
      {rows.length > 0 && (
        <div style={{
          background: "#161C23",
          padding: 20,
          borderRadius: 12
        }}>
          <h3 style={{ marginBottom: 10 }}>Preview ({rows.length} rows)</h3>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {Object.keys(rows[0]).map((h) => (
                    <th
                      key={h}
                      style={{
                        borderBottom: "1px solid #333",
                        padding: 8,
                        textAlign: "left",
                        color: "#888"
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.slice(0, 10).map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((val, j) => (
                      <td key={j} style={{ padding: 8 }}>
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ marginTop: 10, color: "#888" }}>
            Showing first 10 rows
          </p>
        </div>
      )}
    </div>
  );
};

export default UploadRevenue;