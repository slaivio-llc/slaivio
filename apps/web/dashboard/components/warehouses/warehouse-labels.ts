const labels: Record<string, string> = {
  code: "Code de l’emplacement", zone: "Zone", aisle: "Allée", rack: "Rayonnage",
  shelf: "Étagère", position: "Position", capacity_packages: "Capacité en colis",
  anomaly_type: "Type d’anomalie", severity: "Gravité", title: "Titre",
  description: "Description", assigned_name: "Responsable", reason: "Motif",
};

export function warehouseFieldLabel(field: string): string {
  return labels[field] || "Information complémentaire";
}
