import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { KeyRound, Pencil, Plus, UserX } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { PageHeader, Spinner, Badge, Modal, EmptyState, ConfirmButton } from "../../components/ui";
import { useUnitKerjaList } from "../../hooks/useReference";
import type { Role, UserAccount } from "../../types";
import { formatDateTime } from "../../lib/format";
import { ROLE_LABELS } from "../../lib/auth";

export default function PenggunaPage() {
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: ["users", "list"],
    queryFn: () => api.get<UserAccount[]>("/users"),
  });
  const { data: roles } = useQuery({
    queryKey: ["users", "roles"],
    queryFn: () => api.get<Role[]>("/users/roles"),
  });

  const [editing, setEditing] = useState<UserAccount | "new" | null>(null);
  const [resetTarget, setResetTarget] = useState<UserAccount | null>(null);

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => {
      toast.success("Pengguna dinonaktifkan");
      queryClient.invalidateQueries({ queryKey: ["users", "list"] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Gagal menonaktifkan"),
  });

  return (
    <div>
      <PageHeader
        title="Manajemen Pengguna & Hak Akses"
        subtitle="Kelola akun aplikasi beserta peran (role) sesuai struktur organisasi (FR-8.1)"
        actions={
          <button className="btn-primary" onClick={() => setEditing("new")}>
            <Plus size={16} /> Tambah Pengguna
          </button>
        }
      />

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner className="text-brand-600" size={26} />
          </div>
        ) : !users || users.length === 0 ? (
          <EmptyState title="Belum ada pengguna" />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Pengguna</th>
                <th className="px-4 py-3">Peran</th>
                <th className="px-4 py-3">Unit Kerja</th>
                <th className="px-4 py-3">Login Terakhir</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{u.full_name}</p>
                    <p className="text-xs text-slate-500">
                      {u.username} {u.email ? `· ${u.email}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color="blue">{ROLE_LABELS[u.role_code] ?? u.role_name}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.unit_kerja_nama ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(u.last_login_at)}</td>
                  <td className="px-4 py-3">
                    <Badge color={u.is_active ? "green" : "slate"}>{u.is_active ? "Aktif" : "Nonaktif"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost px-2 py-1" title="Ubah" onClick={() => setEditing(u)}>
                        <Pencil size={15} />
                      </button>
                      <button className="btn-ghost px-2 py-1" title="Reset Password" onClick={() => setResetTarget(u)}>
                        <KeyRound size={15} />
                      </button>
                      {u.is_active === 1 && (
                        <ConfirmButton
                          className="btn-ghost px-2 py-1 text-red-500"
                          confirmText={`Nonaktifkan akun ${u.username}?`}
                          onConfirm={() => deactivateMutation.mutate(u.id)}
                        >
                          <UserX size={15} />
                        </ConfirmButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <UserFormModal
          user={editing === "new" ? null : editing}
          roles={roles ?? []}
          onClose={() => setEditing(null)}
          onSuccess={() => {
            setEditing(null);
            queryClient.invalidateQueries({ queryKey: ["users", "list"] });
          }}
        />
      )}

      {resetTarget && <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} />}
    </div>
  );
}

function UserFormModal({ user, roles, onClose, onSuccess }: { user: UserAccount | null; roles: Role[]; onClose: () => void; onSuccess: () => void }) {
  const { data: unitKerjaList } = useUnitKerjaList();
  const [form, setForm] = useState({
    username: user?.username ?? "",
    email: user?.email ?? "",
    password: "",
    fullName: user?.full_name ?? "",
    roleId: user?.role_id ? String(user.role_id) : "",
    unitKerjaId: user?.unit_kerja_id ? String(user.unit_kerja_id) : "",
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        email: form.email || null,
        fullName: form.fullName,
        roleId: Number(form.roleId),
        unitKerjaId: form.unitKerjaId ? Number(form.unitKerjaId) : null,
        isActive: 1,
      };
      if (user) return api.put(`/users/${user.id}`, payload);
      return api.post("/users", { ...payload, username: form.username, password: form.password });
    },
    onSuccess: () => {
      toast.success(user ? "Pengguna diperbarui" : "Pengguna baru ditambahkan");
      onSuccess();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan"),
  });

  const selectedRole = roles.find((r) => String(r.id) === form.roleId)?.code;
  const requiresUnit = selectedRole === "kepala_bidang";

  return (
    <Modal open onClose={onClose} title={user ? "Ubah Pengguna" : "Tambah Pengguna Baru"}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        {!user && (
          <>
            <div>
              <label className="label">Username *</label>
              <input className="input" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div>
              <label className="label">Password Awal * (min. 8 karakter)</label>
              <input type="password" minLength={8} className="input" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <p className="mt-1 text-xs text-slate-400">Pengguna akan diminta mengganti password saat pertama kali masuk.</p>
            </div>
          </>
        )}
        <div>
          <label className="label">Nama Lengkap *</label>
          <input className="input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Peran *</label>
          <select className="input" required value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
            <option value="">Pilih peran</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Unit Kerja {requiresUnit && "*"}</label>
          <select className="input" required={requiresUnit} value={form.unitKerjaId} onChange={(e) => setForm({ ...form, unitKerjaId: e.target.value })}>
            <option value="">- Tidak terikat unit tertentu -</option>
            {unitKerjaList?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nama}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner size={14} />} Simpan
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose }: { user: UserAccount; onClose: () => void }) {
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => api.post<{ ok: boolean; temporaryPassword?: string }>(`/users/${user.id}/reset-password`, {}),
    onSuccess: (res) => {
      setTempPassword(res.temporaryPassword ?? null);
      toast.success("Password berhasil direset");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Gagal mereset password"),
  });

  return (
    <Modal open onClose={onClose} title={`Reset Password: ${user.username}`}>
      <div className="space-y-3">
        {tempPassword ? (
          <div className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            <p className="mb-1 font-medium">Password sementara:</p>
            <code className="rounded bg-white px-2 py-1 text-base font-semibold">{tempPassword}</code>
            <p className="mt-2 text-xs">Sampaikan password ini kepada pengguna secara aman. Pengguna akan diminta menggantinya saat login.</p>
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            Password akun ini akan direset menjadi password sementara acak. Pengguna wajib mengganti password saat login berikutnya.
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={onClose}>
            Tutup
          </button>
          {!tempPassword && (
            <button className="btn-primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending && <Spinner size={14} />} Reset Password
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
