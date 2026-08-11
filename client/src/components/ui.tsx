import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import clsx from "clsx";

export function Button({ className, variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-sky-700 text-white hover:bg-sky-800",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-slate-600 hover:bg-slate-100",
  };
  return <button className={clsx(base, variants[variant], className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      className={clsx(
        "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={clsx("mb-1 block text-xs font-medium text-slate-600", className)} {...props} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function Card({ className, children, title, actions }: { className?: string; children: ReactNode; title?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={clsx("rounded-lg border border-slate-200 bg-white shadow-sm", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          {title && <h3 className="text-sm font-semibold text-slate-800">{title}</h3>}
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

const BADGE_COLORS: Record<string, string> = {
  AKTIF: "bg-green-100 text-green-700",
  PENSIUN: "bg-slate-100 text-slate-600",
  MUTASI_KELUAR: "bg-slate-100 text-slate-600",
  MENINGGAL: "bg-slate-100 text-slate-600",
  CUTI_DI_LUAR_TANGGUNGAN: "bg-amber-100 text-amber-700",
  NON_AKTIF_LAINNYA: "bg-slate-100 text-slate-600",
  BELUM_DIPROSES: "bg-slate-100 text-slate-600",
  SEDANG_DIUSULKAN: "bg-amber-100 text-amber-700",
  SK_TERBIT: "bg-green-100 text-green-700",
  DITUNDA: "bg-red-100 text-red-700",
  REGULER: "bg-sky-100 text-sky-700",
  FUNGSIONAL: "bg-purple-100 text-purple-700",
  PILIHAN: "bg-purple-100 text-purple-700",
  SANGAT_BAIK: "bg-green-100 text-green-700",
  BAIK: "bg-sky-100 text-sky-700",
  CUKUP: "bg-amber-100 text-amber-700",
  KURANG: "bg-red-100 text-red-700",
  SANGAT_KURANG: "bg-red-100 text-red-700",
};

export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const colorClass = (tone && BADGE_COLORS[tone]) || "bg-slate-100 text-slate-600";
  return <span className={clsx("inline-block rounded-full px-2.5 py-0.5 text-xs font-medium", colorClass)}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={clsx("flex items-center justify-center py-10", className)}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-sky-700" />
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-slate-500">{text}</div>;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={clsx("max-h-[90vh] w-full overflow-y-auto rounded-lg bg-white shadow-xl", wide ? "max-w-3xl" : "max-w-lg")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
