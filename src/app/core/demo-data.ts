import { Board, Conversation, Task, TaskState } from './models';

// Cenário inteiramente fictício, com data de referência fixa para a demonstração.
export const DEMO_DATE = '24 de setembro de 2026';
export const DEMO_USER = 'Pessoa Teste';
export const STATE_LABELS: Record<TaskState, string> = {
  aguardando_aceite: 'Aguardando aceite',
  a_fazer: 'A fazer',
  fazendo: 'Em andamento',
  aguardando_terceiro: 'Aguardando terceiro',
  concluido: 'Concluído',
};
export const BOARDS: readonly Board[] = [
  {
    id: 'rotina',
    title: 'Rotina da equipe',
    description: 'Organização e acompanhamento das atividades do dia a dia.',
    area: 'Operações',
    columns: [
      { id: 'entrada', title: 'Entrada' },
      { id: 'planejado', title: 'A fazer', state: 'a_fazer' },
      { id: 'andamento', title: 'Em andamento', state: 'fazendo' },
      { id: 'terceiro', title: 'Aguardando terceiro', state: 'aguardando_terceiro' },
      { id: 'concluido', title: 'Concluído', state: 'concluido' },
    ],
  },
  {
    id: 'planejamento',
    title: 'Planejamento interno',
    description: 'Um espaço para preparar os próximos passos da equipe.',
    area: 'Gestão',
    columns: [
      { id: 'planejado', title: 'A fazer', state: 'a_fazer' },
      { id: 'concluido', title: 'Concluído', state: 'concluido' },
    ],
  },
  {
    id: 'comunicacao',
    title: 'Comunicação da equipe',
    description: 'Materiais e alinhamentos para manter todos por perto.',
    area: 'Comunicação',
    columns: [
      { id: 'entrada', title: 'Ideias' },
      { id: 'andamento', title: 'Em andamento', state: 'fazendo' },
    ],
  },
];
export const TASKS: readonly Task[] = [
  {
    id: 'DEMO-01',
    title: 'Revisar checklist de abertura',
    boardId: 'rotina',
    columnId: 'entrada',
    creator: 'Colega Alfa',
    assignee: DEMO_USER,
    deadline: '25/09/2026',
    state: 'aguardando_aceite',
  },
  {
    id: 'DEMO-02',
    title: 'Organizar materiais de apoio',
    boardId: 'rotina',
    columnId: 'planejado',
    creator: 'Colega Alfa',
    assignee: DEMO_USER,
    deadline: '23/09/2026',
    state: 'a_fazer',
    overdue: true,
  },
  {
    id: 'DEMO-03',
    title: 'Atualizar roteiro de atendimento',
    boardId: 'rotina',
    columnId: 'andamento',
    creator: 'Colega Beta',
    assignee: DEMO_USER,
    deadline: '24/09/2026',
    state: 'fazendo',
  },
  {
    id: 'DEMO-04',
    title: 'Aguardar revisão do material',
    boardId: 'rotina',
    columnId: 'terceiro',
    creator: DEMO_USER,
    assignee: 'Colega Beta',
    deadline: '28/09/2026',
    state: 'aguardando_terceiro',
  },
  {
    id: 'DEMO-05',
    title: 'Conferir lista de materiais',
    boardId: 'rotina',
    columnId: 'concluido',
    creator: 'Colega Alfa',
    assignee: DEMO_USER,
    deadline: '22/09/2026',
    state: 'concluido',
  },
  {
    id: 'DEMO-06',
    title: 'Preparar pauta de alinhamento',
    boardId: 'planejamento',
    columnId: 'planejado',
    creator: 'Colega Beta',
    assignee: DEMO_USER,
    deadline: '28/09/2026',
    state: 'a_fazer',
  },
  {
    id: 'DEMO-07',
    title: 'Revisar comunicado interno',
    boardId: 'comunicacao',
    columnId: 'andamento',
    creator: DEMO_USER,
    assignee: 'Colega Alfa',
    deadline: '25/09/2026',
    state: 'fazendo',
  },
];
export const CONVERSATIONS: readonly Conversation[] = [
  {
    id: 'equipe',
    name: 'Equipe demonstração',
    initials: 'ED',
    description: 'Grupo • 3 participantes fictícios',
    messages: [
      {
        author: 'Colega Alfa',
        text: 'Bom dia, equipe! O checklist de exemplo já está no quadro.',
        time: '09:10',
      },
      {
        author: DEMO_USER,
        text: 'Obrigada! Vou conferir os materiais de apoio.',
        time: '09:12',
        own: true,
      },
      {
        author: 'Colega Beta',
        text: 'Podemos usar a próxima conversa para alinhar o roteiro.',
        time: '09:14',
      },
    ],
  },
  {
    id: 'alfa',
    name: 'Colega Alfa',
    initials: 'CA',
    description: 'Conversa individual fictícia',
    messages: [
      {
        author: 'Colega Alfa',
        text: 'Olá! Separei uma pauta fictícia para nossa demonstração.',
        time: '08:45',
      },
    ],
  },
  {
    id: 'beta',
    name: 'Colega Beta',
    initials: 'CB',
    description: 'Conversa individual fictícia',
    messages: [
      {
        author: 'Colega Beta',
        text: 'O material de exemplo está pronto para revisão.',
        time: '08:30',
      },
    ],
  },
];
