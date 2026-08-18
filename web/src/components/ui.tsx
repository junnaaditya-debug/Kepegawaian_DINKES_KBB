import { type ReactNode } from "react";
import { Loader2, X } from "lucide-react";

export function Spinner({ className = "", size = 20 }: { className?: string; size?: number }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} />;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

const BADGE_COLORS: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700",
  green: "bg-emerald-100 text-emerald-700",
  yellow: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
};

export function Badge({ children, color = "slate" }: { children: ReactNode; color?: keyof typeof BADGE_COLORS }) {
  return <span className={`badge ${BADGE_COLORS[color]}`}>{children}</span>;
}

export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-slate-500">
      {icon}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="max-w-sm text-xs text-slate-500">{description}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = "max-w-lg" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className={`card w-full ${width} max-h-[90vh] overflow-y-auto p-6`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPageChange }: { page: number; pageSize: number; total: number; onPageChange: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
      <span>
        Menampilkan {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} dari {total}
      </span>
      <div className="flex gap-1">
        <button className="btn-secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Sebelumnya
        </button>
        <span className="px-2 py-2">
          {page} / {totalPages}
        </span>
        <button className="btn-secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Berikutnya
        </button>
      </div>
    </div>
  );
}

export function ConfirmButton({
  onConfirm,
  children,
  className = "btn-danger",
  confirmText = "Yakin ingin melanjutkan?",
}: {
  onConfirm: () => void;
  children: ReactNode;
  className?: string;
  confirmText?: string;
}) {
  return (
    <button
      className={className}
      onClick={() => {
        if (window.confirm(confirmText)) onConfirm();
      }}
    >
      {children}
    </button>
  );
}
