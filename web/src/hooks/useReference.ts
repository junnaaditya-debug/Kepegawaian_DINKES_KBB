import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { JenisJabatanFungsional, JenjangJabatanFungsional, UnitKerja } from "../types";

export function useUnitKerjaList() {
  return useQuery({
    queryKey: ["unit-kerja", "list"],
    queryFn: () => api.get<UnitKerja[]>("/unit-kerja"),
    staleTime: 5 * 60_000,
  });
}

export function useJenisJabatanFungsionalList() {
  return useQuery({
    queryKey: ["jabatan-fungsional", "jenis"],
    queryFn: () => api.get<JenisJabatanFungsional[]>("/jabatan-fungsional"),
    staleTime: 5 * 60_000,
  });
}

export function useJenjangAllList() {
  return useQuery({
    queryKey: ["jabatan-fungsional", "jenjang", "all"],
    queryFn: () => api.get<JenjangJabatanFungsional[]>("/jabatan-fungsional/jenjang/all"),
    staleTime: 5 * 60_000,
  });
}
