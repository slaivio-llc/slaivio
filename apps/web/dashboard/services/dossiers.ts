mport { api } from "@/services/api";

import type {
  Dossier,
  DossierDetails,
} from "@/types/dossiers";


export async function getDossiers(): Promise<Dossier[]> {
  const response = await api.get("/dossiers");

  return response.data.dossiers;
}


export async function getDossier(
  dossierId: string
): Promise<DossierDetails> {
  const response = await api.get(
    `/dossiers/${dossierId}`
  );

  return response.data;
}
