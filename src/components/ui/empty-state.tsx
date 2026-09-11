import { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="state-container">
      <div className="empty-card">
        {icon && (
          <div style={{ marginBottom: "16px", color: "var(--muted)" }} aria-hidden="true">
            {icon}
          </div>
        )}
        <h2>{title}</h2>
        <p>{description}</p>
        {action && <div style={{ marginTop: "20px" }}>{action}</div>}
      </div>
    </div>
  );
}
