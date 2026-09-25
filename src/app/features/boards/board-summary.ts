export interface BoardSummary {
  id: string;
  title: string;
  description: string | null;
  department: { name: string } | null;
}
