import { Download } from "lucide-react";

const ExportButton = ({ label = "Export", onClick, disabled = false }) => (
  <button className="secondary-button" type="button" onClick={onClick} disabled={disabled}>
    <Download size={17} />
    {label}
  </button>
);

export default ExportButton;
