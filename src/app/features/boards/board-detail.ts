import { BoardSummary } from './board-summary';

export type BusinessState = 'aguardando_aceite' | 'a_fazer' | 'fazendo' | 'aguardando_terceiro' | 'concluido';

export interface BoardColumn {
  id: string;
  title: string;
  position: number;
  business_state: BusinessState | null;
}

export interface BoardDetail extends BoardSummary {
  columns: BoardColumn[];
}

export type BoardResult =
  | { status: 'loaded'; board: BoardDetail }
  | { status: 'unavailable' | 'forbidden' | 'error' };

export const BUSINESS_STATE_LABELS: Record<BusinessState, string> = {
  aguardando_aceite: 'Aguardando aceite',
  a_fazer: 'A fazer',
  fazendo: 'Fazendo',
  aguardando_terceiro: 'Aguardando terceiro',
  concluido: 'Concluído',
};
