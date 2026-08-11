import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "../api/client";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner } from "../components/ui";
import type { AppUser, UnitKerja } from "../types";
import { formatTanggalWaktu, label } from "../utils/format";

export default function PenggunaPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [resetFor, setResetFor] = useState<AppUser | null>(null);
  const { data, isLoading } = useQuery<AppUser[]>({ queryKey: ["users"], queryFn: () => api.get("/users").then((r) => r.data) });

  async function toggleActive(u: AppUser) {
    await api.put(`/users/${u.id}`, { isActive: !u.isActive });
    qc.invalidateQueries({ queryKey: ["users"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Manajemen User & Role</h1>
          <p className="text-sm text-slate-500">Kelola akun aplikasi dan hak akses (RBAC)</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>+ Tambah User</Button>
      </div>

      <Card>
        {isLoading ? (
          <Spinner />
        ) : !data || data.length === 0 ? (
          <EmptyState text="Belum ada user" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Username</th>
                <th className="py-2 pr-3">Nama</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Unit Kerja</th>
                <th className="py-2 pr-3">Login Terakhir</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id} className="border-b border-slate-50">
                  <td className="py-2 pr-3 font-mono text-xs">{u.username}</td>
                  <td className="py-2 pr-3">{u.nama}</td>
                  <td className="py-2 pr-3">{label(u.role)}</td>
                  <td className="py-2 pr-3">{u.unitKerja?.nama || "-"}</td>
                  <td className="py-2 pr-3">{formatTanggalWaktu(u.lastLoginAt)}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={u.isActive ? "AKTIF" : "PENSIUN"}>{u.isActive ? "Aktif" : "Non-aktif"}</Badge>
                  </td>
                  <td className="space-x-3 py-2 pr-3 text-xs">
                    <button className="font-medium text-sky-700 hover:underline" onClick={() => setResetFor(u)}>
                      Reset Password
                    </button>
                    <button className="font-medium text-slate-600 hover:underline" onClick={() => toggleActive(u)}>
                      {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showAdd && (
        <TambahUserModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false);
            qc.invalidateQueries({ queryKey: ["users"] });
          }}
        />
      )}
      {resetFor && <ResetPasswordModal user={resetFor} onClose={() => setResetFor(null)} />}
    </div>
  );
}

function TambahUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { data: unitList } = useQuery<UnitKerja[]>({ queryKey: ["unit-kerja"], queryFn: () => api.get("/unit-kerja").then((r) => r.data) });
  const [form, setForm] = useState({ username: "", password: "", nama: "", email: "", role: "ADMIN_KEPEGAWAIAN", unitKerjaId: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      await api.post("/users", { ...form, unitKerjaId: form.unitKerjaId || undefined, email: form.email || undefined });
      onSuccess();
    } catch (err) {
      setError(errorMessage(err, "Gagal menyimpan user"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Tambah User">
      <div className="space-y-3">
        <Field label="Username">
          <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </Field>
        <Field label="Password (minimal 8 karakter)">
          <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Field label="Nama Lengkap">
          <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
        </Field>
        <Field label="Email (opsional)">
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Role">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="ADMIN_KEPEGAWAIAN">Admin Kepegawaian</option>
            <option value="KEPALA_BIDANG">Kepala Bidang/Kasubbag</option>
            <option value="KEPALA_DINAS">Kepala Dinas</option>
            <option value="PEGAWAI">Pegawai</option>
          </Select>
        </Field>
        {form.role === "KEPALA_BIDANG" && (
          <Field label="Unit Kerja (cakupan akses)">
            <Select value={form.unitKerjaId} onChange={(e) => setForm({ ...form, unitKerjaId: e.target.value })}>
              <option value="">- Pilih Unit Kerja -</option>
              {unitList?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nama}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={submit} disabled={loading || !form.username || form.password.length < 8 || !form.nama}>
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      await api.post(`/users/${user.id}/reset-password`, { newPassword });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err, "Gagal mereset password"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Reset Password: ${user.nama}`}>
      {done ? (
        <p className="text-sm text-green-700">Password berhasil direset.</p>
      ) : (
        <div className="space-y-3">
          <Field label="Password Baru (minimal 8 karakter)">
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>
              Batal
            </Button>
            <Button onClick={submit} disabled={loading || newPassword.length < 8}>
              {loading ? "Memproses..." : "Reset"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
