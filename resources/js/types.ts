import '@inertiajs/core';

export type Priority = 'low' | 'medium' | 'high';
export type SmartView = 'all' | 'today' | 'upcoming' | 'high' | 'completed' | 'active';
export type SortMode = 'smart' | 'due_date' | 'priority' | 'newest';

export interface Todo {
  id: number;
  title: string;
  notes: string;
  completed: boolean;
  priority: Priority;
  dueDate: string | null;
  listId: number | null;
  listName: string | null;
  listColor: string | null;
  isOverdue: boolean;
  isDueToday: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TodoList {
  id: number;
  name: string;
  slug: string;
  color: string;
  activeCount: number;
  totalCount: number;
}

export interface SmartCounts {
  all: number;
  active: number;
  today: number;
  upcoming: number;
  high: number;
  completed: number;
}

export interface Insights {
  total: number;
  completed: number;
  active: number;
  overdue: number;
  completedToday: number;
  completionRate: number;
  highActive: number;
  mediumActive: number;
  lowActive: number;
}

export interface TodoFilters {
  view: SmartView;
  list: number | null;
  search: string;
  sort: SortMode;
}

export interface FlashToast {
  kind: 'success' | 'info';
  message: string;
}

export interface TodosIndexProps {
  appName: string;
  todos: Todo[];
  lists: TodoList[];
  counts: SmartCounts;
  filters: TodoFilters;
  today: string;
  insights?: Insights;
}

export const LIST_COLORS = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
] as const;

declare module '@inertiajs/core' {
  export interface InertiaConfig {
    flashDataType: {
      toast?: FlashToast;
    };
    sharedPageProps: {
      appName: string;
    };
  }
}

export function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDaysIso(iso: string, days: number): string {
  const date = parseIsoDateLocal(iso);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDueDate(
  dueDate: string,
  todayIso: string,
  completed: boolean,
): { label: string; tone: 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'completed' } {
  const tomorrowIso = addDaysIso(todayIso, 1);
  const yesterdayIso = addDaysIso(todayIso, -1);

  let label: string;
  if (dueDate === todayIso) {
    label = 'Today';
  } else if (dueDate === tomorrowIso) {
    label = 'Tomorrow';
  } else if (dueDate === yesterdayIso) {
    label = 'Yesterday';
  } else {
    const d = parseIsoDateLocal(dueDate);
    const currentYear = parseIsoDateLocal(todayIso).getFullYear();
    label = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(d.getFullYear() !== currentYear ? { year: 'numeric' } : {}),
    });
  }

  if (completed) {
    return { label, tone: 'completed' };
  }
  if (dueDate < todayIso) {
    return { label, tone: 'overdue' };
  }
  if (dueDate === todayIso) {
    return { label, tone: 'today' };
  }
  if (dueDate === tomorrowIso) {
    return { label, tone: 'tomorrow' };
  }
  return { label, tone: 'upcoming' };
}

export function buildFilterParams(filters: {
  view?: string;
  list?: number | null;
  search?: string;
  sort?: string;
}): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.list != null) {
    params.list = String(filters.list);
  } else if (filters.view && filters.view !== 'all') {
    params.view = filters.view;
  }
  if (filters.search && filters.search.trim() !== '') {
    params.search = filters.search.trim();
  }
  if (filters.sort && filters.sort !== 'smart') {
    params.sort = filters.sort;
  }
  return params;
}

export function buildFilterHref(filters: {
  view?: string;
  list?: number | null;
  search?: string;
  sort?: string;
}): string {
  const params = new URLSearchParams(buildFilterParams(filters));
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}
