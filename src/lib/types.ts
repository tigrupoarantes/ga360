// GA 360 Types

export type UserRole = 'CEO' | 'Diretor' | 'Gerente' | 'Colaborador';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  area?: string;
  avatar?: string;
}

export type MeetingType = 'Estratégica' | 'Tática' | 'Operacional' | 'Trade';

export type MeetingStatus = 'Agendada' | 'Em Andamento' | 'Concluída' | 'Cancelada';

export type AIMode = 'Obrigatória' | 'Opcional' | 'Desativada';

export interface Meeting {
  id: string;
  type: MeetingType;
  title: string;
  area: string;
  startDate: Date;
  endDate?: Date;
  status: MeetingStatus;
  aiMode: AIMode;
  participants: User[];
  createdBy: User;
  hasTranscription?: boolean;
  hasAta?: boolean;
}

export type TaskStatus = 'Pendente' | 'Em Andamento' | 'Concluída' | 'Atrasada';

export type TaskPriority = 'Baixa' | 'Média' | 'Alta' | 'Crítica';

export interface Task {
  id: string;
  title: string;
  description?: string;
  assignee: User;
  dueDate: Date;
  priority: TaskPriority;
  status: TaskStatus;
  area: string;
  category?: string;
  linkedTo?: {
    type: 'meeting' | 'process' | 'trade';
    id: string;
  };
  createdAt: Date;
}

export interface KPI {
  id: string;
  name: string;
  value: number;
  target: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
}

export interface DashboardStats {
  totalMeetings: number;
  completedMeetings: number;
  pendingTasks: number;
  overdueTasks: number;
  ritualAdherence: number;
  mci: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  type: 'meeting' | 'process' | 'task';
  date: Date;
  endDate?: Date;
  area: string;
  color?: string;
}

export interface Process {
  id: string;
  name: string;
  description: string;
  area: string;
  frequency: 'Diária' | 'Semanal' | 'Quinzenal' | 'Mensal';
  responsibles: User[];
  checklist: ProcessChecklistItem[];
  lastExecution?: Date;
  nextExecution: Date;
}

export interface ProcessChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  required: boolean;
}
