import { Link, router } from '@inertiajs/react';
import { Calendar, Check, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { buildFilterHref, formatDueDate, type Todo } from '../types';

interface TodoItemProps {
  todo: Todo;
  today: string;
  currentSort: string;
  onEdit: (todo: Todo) => void;
}

const PRIORITY_RING: Record<Todo['priority'], string> = {
  high: 'border-rose-500 hover:bg-rose-50 dark:border-rose-400 dark:hover:bg-rose-500/15',
  medium:
    'border-indigo-400 hover:bg-indigo-50 dark:border-indigo-400 dark:hover:bg-indigo-500/15',
  low: 'border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800',
};

const DUE_BADGE_STYLES: Record<
  'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'completed',
  string
> = {
  overdue: 'bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
  today: 'bg-amber-50 text-amber-700 ring-amber-200/70 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
  tomorrow: 'bg-sky-50 text-sky-700 ring-sky-200/70 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30',
  upcoming: 'bg-slate-100 text-slate-600 ring-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  completed: 'bg-slate-100 text-slate-400 ring-slate-200/60 dark:bg-slate-800/60 dark:text-slate-500 dark:ring-slate-800',
};

export default function TodoItem({ todo, today, currentSort, onEdit }: TodoItemProps) {
  const [busy, setBusy] = useState(false);

  const handleToggle = () => {
    if (busy) return;
    setBusy(true);
    router.patch(
      `/todos/${todo.id}/toggle`,
      {},
      {
        preserveScroll: true,
        onFinish: () => setBusy(false),
      },
    );
  };

  const handleDelete = () => {
    if (busy) return;
    setBusy(true);
    router.delete(`/todos/${todo.id}`, {
      preserveScroll: true,
      onFinish: () => setBusy(false),
    });
  };

  const dueInfo = todo.dueDate ? formatDueDate(todo.dueDate, today, todo.completed) : null;

  return (
    <article
      className={`group flex items-start gap-3.5 rounded-2xl bg-white px-4 py-3.5 shadow-xs ring-1 transition ${
        todo.completed
          ? 'opacity-75 ring-slate-200/60 dark:bg-slate-900/60 dark:ring-slate-800/70'
          : 'ring-slate-200/80 hover:ring-slate-300 dark:bg-slate-900 dark:ring-slate-800 dark:hover:ring-slate-700'
      }`}
    >
      {/* Completion checkbox */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={busy}
        aria-label={todo.completed ? `Mark "${todo.title}" incomplete` : `Mark "${todo.title}" complete`}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
          todo.completed
            ? 'animate-check-pop border-emerald-500 bg-emerald-500 text-white dark:border-emerald-500 dark:bg-emerald-500'
            : PRIORITY_RING[todo.priority]
        } disabled:opacity-60`}
      >
        {todo.completed && <Check className="h-3 w-3 stroke-[3]" />}
      </button>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onEdit(todo)}
            className={`text-left text-sm font-medium leading-snug transition ${
              todo.completed
                ? 'text-slate-400 line-through dark:text-slate-500'
                : 'text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400'
            }`}
          >
            {todo.title}
          </button>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <button
              type="button"
              onClick={() => onEdit(todo)}
              aria-label={`Edit "${todo.title}"`}
              title="Edit task"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              aria-label={`Delete "${todo.title}"`}
              title="Delete task"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/15 dark:hover:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {todo.notes && (
          <p
            className={`mt-1 line-clamp-2 text-xs leading-relaxed ${
              todo.completed
                ? 'text-slate-400 dark:text-slate-600'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {todo.notes}
          </p>
        )}

        {/* Badges */}
        {(dueInfo || todo.listName || todo.priority !== 'medium') && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {dueInfo && (
              <span
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium ring-1 ${
                  DUE_BADGE_STYLES[dueInfo.tone]
                }`}
              >
                <Calendar className="h-3 w-3" />
                {dueInfo.tone === 'overdue' ? `Overdue · ${dueInfo.label}` : dueInfo.label}
              </span>
            )}

            {todo.listId && todo.listName && (
              <Link
                href={buildFilterHref({ list: todo.listId, sort: currentSort })}
                preserveScroll
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/70 transition hover:bg-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: todo.listColor ?? '#6366f1' }}
                />
                {todo.listName}
              </Link>
            )}

            {todo.priority === 'high' && !todo.completed && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600 ring-1 ring-rose-200/70 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30">
                High
              </span>
            )}

            {todo.priority === 'low' && !todo.completed && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200/70 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
                Low
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
