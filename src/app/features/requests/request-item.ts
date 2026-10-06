import { TaskDetail, TaskPostponementRequest } from '../tasks/task-detail';

export type RequestKind = 'acceptance' | 'postponement' | 'reassignment';
export interface RequestItem {
  item_key: string;
  area: 'decide' | 'waiting';
  kind: RequestKind;
  task: TaskDetail;
  request: TaskPostponementRequest | null;
  creator_name: string | null;
  assignee_name: string | null;
  requester_name: string | null;
  refused_assignee_name: string | null;
  justification: string | null;
}

export const REQUEST_LABELS: Record<RequestKind, string> = {
  acceptance: 'Aceite de pendência',
  postponement: 'Adiamento',
  reassignment: 'Reatribuição necessária',
};
