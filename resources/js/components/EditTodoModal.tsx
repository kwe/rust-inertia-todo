import { router, useForm } from '@inertiajs/react';
import { Calendar, Check, Trash2, X } from 'lucide-react';
import { type FormEvent, useEffect } from 'react';
import { addDaysIso, type Priority, type Todo, type TodoList } from '../types';

interface EditTodoModalProps {
  todo: Todo | null;
  lists: TodoList[];
  today: string;
  onClose: () => void;
}

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export default function EditTodoModal({ todo, lists, today, onClose }: EditTodoModalProps) {
  const form = useForm({
    title: todo?.title ?? '',
    notes: todo?.notes ?? '',
    priority: (todo?.priority ?? 'medium') as Priority,
    dueDate: todo?.dueDate ?? '',
    listId: todo?.listId ?? (null as number | null),
    completed: todo?.completed ?? false,
  });

  useEffect(() => {
    if (!todo) return;
    form.setData({
      title: todo.title,
      notes: todo.notes,
      priority: todo.priority,
      dueDate: todo.dueDate ?? '',
      listId: todo.listId,
      completed: todo.completed,
    });
    form.clearErrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todo]);

  useEffect(() => {
    if (!todo) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [todo, onClose]);

  if (!todo) return null;

  const tomorrow = addDaysIso(today, 1);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    form.patch(`/todos/${todo.id}`, {
      preserveScroll: true,
      onSuccess: () => onClose(),
    });
  };

  const handleDelete = () => {
    router.delete(`/todos/${todo.id}`, {
      preserveScroll: true,
      onSuccess: () => onClose(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-todo-title"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2
              id="edit-todo-title"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Edit task
            </h2>
            <button
              type="button"
              onClick={() => form.setData('completed', !form.data.completed)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 transition ${
                form.data.completed
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30'
                  : 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700'
              }`}
            >
              <Check className="h-3 w-3" />
              {form.data.completed ? 'Completed' : 'Active'}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="todo-edit-title"
              className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300"
            >
              Title
            </label>
            <input
              id="todo-edit-title"
              type="text"
              autoFocus
              value={form.data.title}
              onChange={(e) => form.setData('title', e.target.value)}
              maxLength={200}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
            />
            {form.errors.title && (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{form.errors.title}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="todo-edit-notes"
              className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300"
            >
              Notes
            </label>
            <textarea
              id="todo-edit-notes"
              rows={3}
              value={form.data.notes}
              onChange={(e) => form.setData('notes', e.target.value)}
              maxLength={2000}
              placeholder="Optional context, subtasks, or links..."
              className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
            />
            {form.errors.notes && (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{form.errors.notes}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                Priority
              </span>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                {PRIORITIES.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => form.setData('priority', opt.value)}
                    className={`rounded-lg py-1.5 text-xs font-medium transition ${
                      form.data.priority === opt.value
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {form.errors.priority && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  {form.errors.priority}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="todo-edit-list"
                className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                List
              </label>
              <select
                id="todo-edit-list"
                value={form.data.listId ?? ''}
                onChange={(e) =>
                  form.setData('listId', e.target.value ? Number(e.target.value) : null)
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
              >
                <option value="">No list</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
              {form.errors.listId && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  {form.errors.listId}
                </p>
              )}
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Due date
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1">
                <Calendar className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={form.data.dueDate}
                  onChange={(e) => form.setData('dueDate', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
                />
              </div>
              <button
                type="button"
                onClick={() => form.setData('dueDate', today)}
                className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => form.setData('dueDate', tomorrow)}
                className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Tomorrow
              </button>
              {form.data.dueDate && (
                <button
                  type="button"
                  onClick={() => form.setData('dueDate', '')}
                  className="rounded-xl px-2.5 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  Clear
                </button>
              )}
            </div>
            {form.errors.dueDate && (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                {form.errors.dueDate}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/15"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete task
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={form.processing}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {form.processing ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
