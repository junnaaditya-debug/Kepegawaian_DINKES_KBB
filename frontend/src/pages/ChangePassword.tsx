import { useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";

export default function ChangePassword() {
  const { push } = useToast();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/auth/change-password", { oldPassword, newPassword });
      push("Password berhasil diubah.", "success");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengubah password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h2 className="mb-4 text-xl font-bold text-slate-800">Ubah Password</h2>
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Input label="Password Lama" type="password" required value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
          <Input label="Password Baru" type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} hint="Minimal 8 karakter." />
          <Input label="Konfirmasi Password Baru" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" loading={saving} className="w-full">Simpan Password</Button>
        </form>
      </Card>
    </div>
  );
}
