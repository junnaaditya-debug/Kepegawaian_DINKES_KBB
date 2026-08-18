import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-3xl font-bold text-slate-300">404</p>
      <p className="mt-2 text-sm text-slate-500">Halaman tidak ditemukan</p>
      <Link to="/" className="btn-primary mt-4">
        Kembali ke Dashboard
      </Link>
    </div>
  );
}
