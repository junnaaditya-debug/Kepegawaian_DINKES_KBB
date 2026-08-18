import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PageHeader } from "../components/ui";

export default function ChangePassword() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password baru tidak cocok");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/change-password", { oldPassword, newPassword });
      toast.success("Password berhasil diubah, silakan masuk kembali");
      logout();
      navigate("/login", { replace: true });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal mengubah password");
    } finally {
      setLoading(false);
      refreshUser();
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Ubah Password" subtitle={`Masuk sebagai ${user?.username}`} />
      <div className="card p-6">
        {user?.mustChangePassword && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Akun Anda menggunakan password sementara. Silakan ganti password sebelum melanjutkan.
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Password Lama</label>
            <input className="input" type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password Baru (minimal 8 karakter)</label>
            <input className="input" type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <div>
            <label className="label">Konfirmasi Password Baru</label>
            <input className="input" type="password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
          <button className="btn-primary w-full" disabled={loading}>
            Simpan Password Baru
          </button>
        </form>
      </div>
    </div>
  );
}
