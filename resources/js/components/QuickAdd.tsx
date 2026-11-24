import { useForm } from '@inertiajs/react';
import { Calendar, ChevronDown, FileText, Flag, Folder, Plus, X } from 'lucide-react';
import { type FormEvent, type RefObject, useEffect, useState } from 'react';
import { addDaysIso, type Priority, type SmartView, type TodoList } from '../types';

interface QuickAddProps {
  lists: TodoList[];
  activeListId: number | null;
  view: SmartView;
  today: string;
  inputRef: RefObject<HTMLInputElement | null>;
}

const PRIORITY_OPTIONS: { value: Priority; label: string; dot: string }[] = [
  { value: 'low', label: 'Low', dot: 'bg-slate-400' },
  { value: 'medium', label: 'Medium', dot: 'bg-indigo-500' },
  { value: 'high', label: 'High', dot: 'bg-rose-500' },
];

export default function QuickAdd({ lists, activeListId, view, today, inputRef }: QuickAddProps) {
  const [expanded, setExpanded] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const tomorrow = addDaysIso(today, 1);

  // Start from values that keep a new task inside the view it is added from;
  // otherwise it would be filtered out of sight the moment it is saved.
  const defaultDueDate = view === 'today' ? today : view === 'upcoming' ? tomorrow : '';
  const defaultPriority: Priority = view === 'high' ? 'high' : 'medium';

  const form = useForm({
    title: '',
    notes: '',
    priority: defaultPriority as Priority,
    dueDate: defaultDueDate,
    listId: activeListId as number | null,
  });

  useEffect(() => {
    form.setData('listId', activeListId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeListId]);

  useEffect(() => {
    form.setData((data) => ({ ...data, priority: defaultPriority, dueDate: defaultDueDate }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    form.post('/todos', {
      preserveScroll: true,
      onSuccess: () => {
        form.setData((data) => ({
          ...data,
          title: '',
          notes: '',
          priority: defaultPriority,
          dueDate: defaultDueDate,
        }));
        setShowNotes(false);
      },
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200/80 transition focus-within:ring-2 focus-within:ring-indigo-500/40 dark:bg-slate-900 dark:ring-slate-800 dark:focus-within:ring-indigo-400/40"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
          <Plus className="h-4 w-4" />
        </span>

        <input
          ref={inputRef}
          type="text"
          value={form.data.title}
          onFocus={() => setExpanded(true)}
          onChange={(e) => form.setData('title', e.target.value)}
          placeholder="Add a task... (press 'n' to focus)"
          maxLength={200}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
        />

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label="Toggle task options"
          className="hidden items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 sm:inline-flex dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          Options
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>

        <button
          type="submit"
          disabled={form.processing}
          className="shrink-0 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {form.processing ? 'Adding...' : 'Add task'}
        </button>
      </div>

      {form.errors.title && (
        <p className="mt-2 pl-9.5 text-xs font-medium text-rose-600 dark:text-rose-400">
          {form.errors.title}
        </p>
      )}

      {(expanded || showNotes || form.hasErrors) && (
        <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
          {showNotes && (
            <div>
              <textarea
                value={form.data.notes}
                onChange={(e) => form.setData('notes', e.target.value)}
                placeholder="Add notes, links, or details..."
                rows={2}
                maxLength={2000}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
              />
              {form.errors.notes && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  {form.errors.notes}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {/* Priority selector */}
            <div className="inline-flex items-center rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800/80">
              <Flag className="mx-1.5 h-3.5 w-3.5 text-slate-400" />
              {PRIORITY_OPTIONS.map((opt) => {
                const selected = form.data.priority === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => form.setData('priority', opt.value)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition ${
                      selected
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${opt.dot}`} />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Due date quick presets + picker */}
            <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800/80">
              <Calendar className="ml-1.5 mr-0.5 h-3.5 w-3.5 text-slate-400" />
              <button
                type="button"
                onClick={() => form.setData('dueDate', form.data.dueDate === today ? '' : today)}
                className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
                  form.data.dueDate === today
                    ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-900 dark:text-indigo-400'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() =>
                  form.setData('dueDate', form.data.dueDate === tomorrow ? '' : tomorrow)
                }
                className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
                  form.data.dueDate === tomorrow
                    ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-900 dark:text-indigo-400'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Tomorrow
              </button>
              <input
                type="date"
                value={form.data.dueDate}
                onChange={(e) => form.setData('dueDate', e.target.value)}
                aria-label="Due date"
                className="rounded-lg bg-transparent px-1.5 py-0.5 text-xs text-slate-600 focus:outline-none dark:text-slate-300"
              />
              {form.data.dueDate && (
                <button
                  type="button"
                  onClick={() => form.setData('dueDate', '')}
                  aria-label="Clear due date"
                  className="rounded-md p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* List selector */}
            <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2 py-1 dark:bg-slate-800/80">
              <Folder className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={form.data.listId ?? ''}
                onChange={(e) =>
                  form.setData('listId', e.target.value ? Number(e.target.value) : null)
                }
                aria-label="Assign list"
                className="bg-transparent text-xs font-medium text-slate-600 focus:outline-none dark:text-slate-300"
              >
                <option value="">No list</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes toggle */}
            <button
              type="button"
              onClick={() => setShowNotes((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-medium transition ${
                showNotes
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Notes
            </button>
          </div>

          {(form.errors.dueDate || form.errors.listId || form.errors.priority) && (
            <div className="flex flex-wrap gap-3 text-xs text-rose-600 dark:text-rose-400">
              {form.errors.dueDate && <span>{form.errors.dueDate}</span>}
              {form.errors.listId && <span>{form.errors.listId}</span>}
              {form.errors.priority && <span>{form.errors.priority}</span>}
            </div>
          )}
        </div>
      )}
    </form>
  );
}
