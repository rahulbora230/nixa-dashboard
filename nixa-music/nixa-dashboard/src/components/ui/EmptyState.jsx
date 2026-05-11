import { Inbox } from "lucide-react";

const EmptyState = ({ title = "Nothing here yet", message = "New activity will appear here when available.", icon: Icon = Inbox }) => (
  <div className="empty-state polished-empty">
    <Icon size={26} />
    <div>
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  </div>
);

export default EmptyState;
