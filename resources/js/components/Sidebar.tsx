import { Deferred, Link, router, useForm } from '@inertiajs/react';
import {
  CalendarClock,
  CheckCircle2,
  Flag,
  Layers,
  Moon,
  Plus,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { type FormEvent, useState } from 'react';
import {
  buildFilterHref,
  type Insights,
  LIST_COLORS,
  type SmartCounts,
  type TodoFilters,
  type TodoList,
} from '../types';

interface SidebarProps {
  appName: string;
  counts: SmartCounts;
  lists: TodoList[];
  filters: TodoFilters;
  insights?: Insights;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigate?: () => void;
}

function InsightsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-3.5 w-8 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800" />
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="h-11 rounded-lg bg-slate-200/80 dark:bg-slate-800/80" />
        <div className="h-11 rounded-lg bg-slate-200/80 dark:bg-slate-800/80" />
      </div>
      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}

function InsightsCard({ insights }: { insights?: Insights }) {
  if (!insights) {
    return <InsightsSkeleton />;
  }

  const activeTotal = Math.max(
    insights.highActive + insights.mediumActive + insights.lowActive,
    1,
  );
  const highPct = Math.round((insights.highActive / activeTotal) * 100);
  const medPct = Math.round((insights.mediumActive / activeTotal) * 100);
  const lowPct = Math.max(0, 100 - highPct - medPct);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600 dark:text-slate-300">Completion</span>
        <span className="font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
          {insights.completionRate}%
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
          style={{ width: `${insights.completionRate}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-white/80 px-2.5 py-2 ring-1 ring-slate-200/70 dark:bg-slate-900/80 dark:ring-slate-800">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Done today
          </div>
          <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {insights.completedToday}
          </div>
        </div>
        <div className="rounded-lg bg-white/80 px-2.5 py-2 ring-1 ring-slate-200/70 dark:bg-slate-900/80 dark:ring-slate-800">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Overdue
          </div>
          <div
            className={`mt-0.5 text-sm font-semibold tabular-nums ${
              insights.overdue > 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {insights.overdue}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>Active mix</span>
          <span className="tabular-nums">{insights.active} open</span>
        </div>
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          {insights.active > 0 && (
            <>
              {insights.highActive > 0 && (
                <div
                  className="bg-rose-500 transition-all duration-300"
                  style={{ width: `${highPct}%` }}
                  title={`High: ${insights.highActive}`}
                />
              )}
              {insights.mediumActive > 0 && (
                <div
                  className="bg-indigo-500 transition-all duration-300"
                  style={{ width: `${medPct}%` }}
                  title={`Medium: ${insights.mediumActive}`}
                />
              )}
              {insights.lowActive > 0 && (
                <div
                  className="bg-slate-400 transition-all duration-300 dark:bg-slate-500"
                  style={{ width: `${lowPct}%` }}
                  title={`Low: ${insights.lowActive}`}
                />
              )}
            </>
          )}
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            High {insights.highActive}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            Med {insights.mediumActive}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
            Low {insights.lowActive}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({
  appName,
  counts,
  lists,
  filters,
  insights,
  theme,
  onToggleTheme,
  onNavigate,
}: SidebarProps) {
  const [creatingList, setCreatingList] = useState(false);
  const listForm = useForm({
    name: '',
    color: LIST_COLORS[0] as string,
  });

  const smartViews = [
    {
      id: 'all' as const,
      label: 'All Tasks',
      count: counts.all,
      icon: Layers,
      accent: 'text-indigo-500',
    },
    {
      id: 'today' as const,
      label: 'Today',
      count: counts.today,
      icon: Sun,
      accent: 'text-amber-500',
    },
    {
      id: 'upcoming' as const,
      label: 'Upcoming',
      count: counts.upcoming,
      icon: CalendarClock,
      accent: 'text-sky-500',
    },
    {
      id: 'high' as const,
      label: 'High Priority',
      count: counts.high,
      icon: Flag,
      accent: 'text-rose-500',
    },
    {
      id: 'completed' as const,
      label: 'Completed',
      count: counts.completed,
      icon: CheckCircle2,
      accent: 'text-emerald-500',
    },
  ];

  const handleCreateList = (e: FormEvent) => {
    e.preventDefault();
    listForm.post('/lists', {
      preserveScroll: true,
      onSuccess: () => {
        listForm.reset();
        setCreatingList(false);
        onNavigate?.();
      },
    });
  };

  const handleDeleteList = (list: TodoList) => {
    router.delete(`/lists/${list.id}`, {
      preserveScroll: true,
    });
  };

  return (
    <div className="flex h-full flex-col justify-between gap-6 p-4">
      <div className="space-y-6">
        {/* Brand header */}
        <div className="flex items-center justify-between px-1">
          <Link
            href="/"
            preserveScroll
            onClick={onNavigate}
            className="flex items-center gap-2.5 text-slate-900 dark:text-white"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/25">
              <svg
                viewBox="0 0 24 24"
                className="h-4.5 w-4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <div>
              <div className="text-sm font-semibold tracking-tight">{appName}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Focus &amp; flow
              </div>
            </div>
          </Link>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        {/* Smart views */}
        <nav className="space-y-1" aria-label="Smart views">
          <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Views
          </div>
          {smartViews.map((item) => {
            const Icon = item.icon;
            const active = filters.list === null && filters.view === item.id;
            const href = buildFilterHref({
              view: item.id,
              list: null,
              sort: filters.sort,
            });
            return (
              <Link
                key={item.id}
                href={href}
                preserveScroll
                onClick={onNavigate}
                className={`group flex items-center justify-between rounded-xl px-2.5 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/80 dark:bg-slate-800/90 dark:text-white dark:ring-slate-700/80'
                    : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon
                    className={`h-4 w-4 transition ${
                      active ? item.accent : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                    }`}
                  />
                  <span>{item.label}</span>
                </span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-xs tabular-nums ${
                    active
                      ? 'bg-indigo-50 font-semibold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {item.count}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Custom Lists */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Lists
            </span>
            <button
              type="button"
              onClick={() => {
                setCreatingList((v) => !v);
                listForm.clearErrors();
              }}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              {creatingList ? (
                <>
                  <X className="h-3 w-3" />
                  Cancel
                </>
              ) : (
                <>
                  <Plus className="h-3 w-3" />
                  New list
                </>
              )}
            </button>
          </div>

          {creatingList && (
            <form
              onSubmit={handleCreateList}
              className="rounded-xl bg-white p-2.5 shadow-xs ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800"
            >
              <input
                type="text"
                value={listForm.data.name}
                onChange={(e) => listForm.setData('name', e.target.value)}
                placeholder="List name..."
                autoFocus
                maxLength={40}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:bg-slate-950"
              />
              {listForm.errors.name && (
                <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
                  {listForm.errors.name}
                </p>
              )}

              <div className="mt-2.5 flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {LIST_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => listForm.setData('color', hex)}
                      aria-label={`Select color ${hex}`}
                      className={`h-4 w-4 rounded-full transition ${
                        listForm.data.color === hex
                          ? 'scale-110 ring-2 ring-slate-900 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-slate-900'
                          : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={listForm.processing}
                  className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                >
                  {listForm.processing ? 'Adding...' : 'Add'}
                </button>
              </div>
            </form>
          )}

          <nav className="space-y-1" aria-label="Custom lists">
            {lists.map((list) => {
              const active = filters.list === list.id;
              const href = buildFilterHref({
                list: list.id,
                sort: filters.sort,
              });
              return (
                <div
                  key={list.id}
                  className={`group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-sm transition ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/80 dark:bg-slate-800/90 dark:text-white dark:ring-slate-700/80'
                      : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-100'
                  }`}
                >
                  <Link
                    href={href}
                    preserveScroll
                    onClick={onNavigate}
                    className="flex min-w-0 flex-1 items-center gap-2.5 py-0.5 font-medium"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: list.color }}
                    />
                    <span className="truncate">{list.name}</span>
                  </Link>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDeleteList(list)}
                      aria-label={`Delete list ${list.name}`}
                      title={`Delete ${list.name}`}
                      className="hidden rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 group-hover:inline-flex focus:inline-flex dark:hover:bg-rose-500/15 dark:hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-5 text-right text-xs tabular-nums text-slate-400 dark:text-slate-500">
                      {list.activeCount}
                    </span>
                  </div>
                </div>
              );
            })}
            {lists.length === 0 && (
              <p className="px-2.5 py-1.5 text-xs text-slate-400 dark:text-slate-500">
                No lists yet. Create one above.
              </p>
            )}
          </nav>
        </div>
      </div>

      {/* Deferred Insights Card */}
      <div className="rounded-2xl bg-slate-100/80 p-3.5 ring-1 ring-slate-200/70 dark:bg-slate-900/70 dark:ring-slate-800/80">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Insights
          </span>
          <span className="rounded-full bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
            Live
          </span>
        </div>
        <Deferred data="insights" fallback={<InsightsSkeleton />}>
          <InsightsCard insights={insights} />
        </Deferred>
      </div>
    </div>
  );
}
