import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import type { AppUser, UnitKerja, Role } from "../../types";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN_KEPEGAWAIAN: "Admin Kepegawaian",
  KEPALA_BIDANG: "Kepala Bidang/Kasubbag",
  KEPALA_DINAS: "Kepala Dinas",
  PEGAWAI: "Pegawai",
};

export default function UsersList() {
  const { push } = useToast();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [unitKerjaList, setUnitKerjaList] = useState<UnitKerja[]>([]);
  const [modalUser, setModalUser] = useState<AppUser | null | "new">(null);

  async function load() {
    const res = await api.get<{ data: AppUser[] }>("/users");
    setUsers(res.data);
  }

  useEffect(() => {
    load();
    api.get<{ data: UnitKerja[] }>("/unit-kerja").then((res) => setUnitKerjaList(res.data));
  }, []);

  async function deactivate(u: AppUser) {
    if (!confirm(`Nonaktifkan user "${u.username}"?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      push("User dinonaktifkan.", "success");
      load();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Gagal menonaktifkan user.", "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Manajemen User &amp; Role</h2>
        <Button onClick={() => setModalUser("new")}>+ Tambah User</Button>
      </div>

      <Card>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="py-2 pr-4">Username</th><th className="py-2 pr-4">Nama</th><th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Unit Kerja</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100">
                <td className="py-2.5 pr-4 font-mono text-xs">{u.username}</td>
                <td className="py-2.5 pr-4 font-medium">{u.nama_lengkap}</td>
                <td className="py-2.5 pr-4"><Badge color="blue">{ROLE_LABEL[u.role]}</Badge></td>
                <td className="py-2.5 pr-4 text-slate-600">{u.unit_kerja_nama ?? "-"}</td>
                <td className="py-2.5 pr-4">{u.is_active ? <Badge color="green">Aktif</Badge> : <Badge color="red">Nonaktif</Badge>}</td>
                <td className="py-2.5 pr-4 text-right">
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setModalUser(u)} className="text-brand-600 hover:underline">Edit</button>
                    {u.is_active === 1 && <button onClick={() => deactivate(u)} className="text-red-600 hover:underline">Nonaktifkan</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {modalUser && (
        <UserModal user={modalUser === "new" ? null : modalUser} unitKerjaList={unitKerjaList} onClose={() => setModalUser(null)} onSaved={() => { setModalUser(null); load(); }} />
      )}
    </div>
  );
}

function UserModal({ user, unitKerjaList, onClose, onSaved }: { user: AppUser | null; unitKerjaList: UnitKerja[]; onClose: () => void; onSaved: () => void }) {
  const { push } = useToast();
  const isEdit = Boolean(user);
  const [form, setForm] = useState({
    username: user?.username ?? "",
    email: user?.email ?? "",
    namaLengkap: user?.nama_lengkap ?? "",
    role: user?.role ?? "ADMIN_KEPEGAWAIAN",
    unitKerjaId: user?.unit_kerja_id ?? "",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isEdit && user) {
        await api.put(`/users/${user.id}`, {
          email: form.email,
          namaLengkap: form.namaLengkap,
          role: form.role,
          unitKerjaId: form.unitKerjaId || null,
          password: form.password || undefined,
        });
      } else {
        await api.post("/users", {
          username: form.username,
          email: form.email,
          namaLengkap: form.namaLengkap,
          role: form.role,
          unitKerjaId: form.unitKerjaId || null,
          password: form.password,
        });
      }
      push("Data user berhasil disimpan.", "success");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan user.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit User" : "Tambah User Baru"}>
      <form onSubmit={submit} className="space-y-3">
        <Input label="Username" required disabled={isEdit} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <Input label="Nama Lengkap" required value={form.namaLengkap} onChange={(e) => setForm({ ...form, namaLengkap: e.target.value })} />
        <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Select label="Role" required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
          {Object.entries(ROLE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Select label="Unit Kerja" value={form.unitKerjaId ?? ""} onChange={(e) => setForm({ ...form, unitKerjaId: e.target.value })}>
          <option value="">- Tidak terikat unit kerja -</option>
          {unitKerjaList.map((u) => <option key={u.id} value={u.id}>{u.nama}</option>)}
        </Select>
        <Input label={isEdit ? "Password Baru (kosongkan jika tidak diubah)" : "Password"} type="password" required={!isEdit} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" loading={saving}>Simpan</Button>
        </div>
      </form>
    </Modal>
  );
}
