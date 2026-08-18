import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import { Loader2, ShieldCheck } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal masuk, coba lagi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-800 via-brand-700 to-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center text-white">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-lg font-semibold">SIMPEG-DINKES KBB</h1>
          <p className="text-sm text-brand-100">Sistem Informasi Kepegawaian Dinas Kesehatan Kabupaten Bandung Barat</p>
        </div>

        <div className="card p-6">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Masuk ke Akun Anda</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading && <Loader2 size={16} className="animate-spin" />}
              Masuk
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-brand-100">
          Data kepegawaian bersifat rahasia. Akses hanya untuk pengguna resmi yang berwenang.
        </p>
      </div>
    </div>
  );
}
