import { useEffect } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const Toast = ({ toast, onClose }) => {
  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = window.setTimeout(onClose, 4200);
    return () => window.clearTimeout(timer);
  }, [onClose, toast]);

  if (!toast) {
    return null;
  }

  const Icon = icons[toast.type] || Info;

  return (
    <div className={`toast toast-${toast.type || "info"}`} role="status">
      <Icon size={18} />
      <span>{toast.message}</span>
      <button type="button" onClick={onClose} aria-label="Close notification">
        <X size={16} />
      </button>
    </div>
  );
};

export default Toast;
