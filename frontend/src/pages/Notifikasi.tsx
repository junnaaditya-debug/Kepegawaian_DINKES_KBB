import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

interface NotifikasiItem {
  id: string;
  judul: string;
  pesan: string;
  tipe: string;
  is_read: number;
  created_at: string;
}

export default function NotifikasiPage() {
  const [items, setItems] = useState<NotifikasiItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await api.get<{ data: NotifikasiItem[] }>("/notifikasi");
    setItems(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function markAllRead() {
    await api.post("/notifikasi/read-all");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Notifikasi</h2>
        <Button variant="secondary" onClick={markAllRead}>Tandai Semua Dibaca</Button>
      </div>
      <Card>
        {loading ? (
          <p className="text-slate-400">Memuat...</p>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-slate-400">Belum ada notifikasi.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((n) => (
              <li key={n.id} className={`py-3 ${!n.is_read ? "bg-brand-50/50" : ""}`}>
                <p className="text-sm font-medium text-slate-800">{n.judul}</p>
                <p className="text-sm text-slate-600">{n.pesan}</p>
                <p className="mt-1 text-xs text-slate-400">{new Date(n.created_at).toLocaleString("id-ID")}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
