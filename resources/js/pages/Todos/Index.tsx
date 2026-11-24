import { Head, router } from '@inertiajs/react';
import {
  ArrowUpDown,
  CheckCheck,
  CheckCircle2,
  Menu,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import EditTodoModal from '../../components/EditTodoModal';
import QuickAdd from '../../components/QuickAdd';
import Sidebar from '../../components/Sidebar';
import ToastContainer from '../../components/ToastContainer';
import TodoItem from '../../components/TodoItem';
import {
  buildFilterParams,
  type SortMode,
  type Todo,
  type TodosIndexProps,
} from '../../types';

const VIEW_TITLES: Record<string, { title: string; subtitle: string }> = {
  all: { title: 'All Tasks', subtitle: 'Everything across your workspace' },
  today: { title: 'Today', subtitle: 'Due today or overdue — stay focused' },
  upcoming: { title: 'Upcoming', subtitle: 'Scheduled for future dates' },
  high: { title: 'High Priority', subtitle: 'Important tasks needing attention' },
  completed: { title: 'Completed', subtitle: 'Finished tasks you can review or clear' },
  active: { title: 'Active', subtitle: 'Open tasks remaining' },
};

export default function TodosIndex({
  appName,
  todos,
  lists,
  counts,
  filters,
  today,
  insights,
}: TodosIndexProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [searchValue, setSearchValue] = useState(filters.search);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'dark';
    }
    return 'light';
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const quickAddInputRef = useRef<HTMLInputElement>(null);

  // The search term this page last asked the server for. A response that merely
  // echoes it back must not touch the input: the user may have typed more since.
  const requestedSearchRef = useRef(filters.search);

  useEffect(() => {
    if (filters.search === requestedSearchRef.current) return;
    // The search changed for another reason (navigation, redirect): adopt it.
    requestedSearchRef.current = filters.search;
    setSearchValue(filters.search);
  }, [filters.search]);

  // Global keyboard shortcuts: '/' focuses search, 'n' focuses QuickAdd
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (editingTodo) return;
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isTyping || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'n') {
        e.preventDefault();
        quickAddInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingTodo]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem('theme', next);
    } catch {
      // ignore storage failures
    }
  };

  // Debounced partial reload for live search
  useEffect(() => {
    if (searchValue.trim() === filters.search) return;

    const timer = window.setTimeout(() => {
      requestedSearchRef.current = searchValue.trim();
      router.get(
        '/',
        buildFilterParams({
          view: filters.view,
          list: filters.list,
          search: searchValue,
          sort: filters.sort,
        }),
        {
          preserveState: true,
          preserveScroll: true,
          replace: true,
          only: ['todos', 'filters'],
        },
      );
    }, 180);

    return () => window.clearTimeout(timer);
  }, [searchValue, filters.search, filters.view, filters.list, filters.sort]);

  const handleSortChange = (nextSort: SortMode) => {
    requestedSearchRef.current = searchValue.trim();
    router.get(
      '/',
      buildFilterParams({
        view: filters.view,
        list: filters.list,
        search: searchValue,
        sort: nextSort,
      }),
      {
        preserveState: true,
        preserveScroll: true,
        replace: true,
        only: ['todos', 'filters'],
      },
    );
  };

  const handleClearSearch = () => {
    setSearchValue('');
    requestedSearchRef.current = '';
    router.get(
      '/',
      buildFilterParams({
        view: filters.view,
        list: filters.list,
        search: '',
        sort: filters.sort,
      }),
      {
        preserveState: true,
        preserveScroll: true,
        replace: true,
        only: ['todos', 'filters'],
      },
    );
  };

  const handleClearCompleted = () => {
    const url = filters.list ? `/todos/completed?list=${filters.list}` : '/todos/completed';
    router.delete(url, { preserveScroll: true });
  };

  const activeList = filters.list !== null ? lists.find((l) => l.id === filters.list) : null;
  const headerMeta = activeList
    ? {
        title: activeList.name,
        subtitle: `${activeList.activeCount} active · ${activeList.totalCount} total in this list`,
      }
    : VIEW_TITLES[filters.view] ?? VIEW_TITLES.all;

  const activeTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);
  const showSplitSections = filters.view !== 'completed' && activeTodos.length > 0 && completedTodos.length > 0;

  const completedInScope = activeList
    ? activeList.totalCount - activeList.activeCount
    : counts.completed;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Head title={`${headerMeta.title} — ${appName}`} />

      <div className="mx-auto flex min-h-screen max-w-7xl">
        {/* Desktop Sidebar */}
        <aside className="hidden w-[280px] shrink-0 border-r border-slate-200/80 bg-slate-100/60 lg:block dark:border-slate-800/80 dark:bg-slate-900/40">
          <div className="sticky top-0 h-screen overflow-y-auto">
            <Sidebar
              appName={appName}
              counts={counts}
              lists={lists}
              filters={filters}
              insights={insights}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
          </div>
        </aside>

        {/* Mobile Drawer */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 flex lg:hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSidebarOpen(false);
            }}
          >
            <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs" onClick={() => setSidebarOpen(false)} />
            <aside className="relative z-10 h-full w-[280px] overflow-y-auto bg-slate-50 shadow-xl dark:bg-slate-950">
              <Sidebar
                appName={appName}
                counts={counts}
                lists={lists}
                filters={filters}
                insights={insights}
                theme={theme}
                onToggleTheme={toggleTheme}
                onNavigate={() => setSidebarOpen(false)}
              />
            </aside>
          </div>
        )}

        {/* Main Workspace */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
            {/* Header */}
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open navigation menu"
                  className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-600 shadow-xs ring-1 ring-slate-200 lg:hidden dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800"
                >
                  <Menu className="h-4.5 w-4.5" />
                </button>

                <div>
                  <div className="flex items-center gap-2.5">
                    {activeList && (
                      <span
                        className="h-3.5 w-3.5 rounded-full ring-2 ring-white dark:ring-slate-950"
                        style={{ backgroundColor: activeList.color }}
                      />
                    )}
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {headerMeta.title}
                    </h1>
                    <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {todos.length}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {headerMeta.subtitle}
                  </p>
                </div>
              </div>

              {completedInScope > 0 && (
                <button
                  type="button"
                  onClick={handleClearCompleted}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-xs ring-1 ring-slate-200/80 transition hover:bg-slate-50 hover:text-rose-600 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800 dark:hover:text-rose-400"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Clear completed ({completedInScope})
                </button>
              )}
            </header>

            {/* Search & Sort Toolbar */}
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Search tasks or notes..."
                  aria-label="Search tasks"
                  className="w-full rounded-xl bg-white py-2 pr-14 pl-10 text-sm text-slate-900 shadow-xs ring-1 ring-slate-200/80 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/40 focus:outline-none dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-800 dark:placeholder:text-slate-500 dark:focus:ring-indigo-400/40"
                />
                {searchValue ? (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    aria-label="Clear search"
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500">
                    /
                  </kbd>
                )}
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-xs ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
                <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                <label htmlFor="sort-select" className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Sort
                </label>
                <select
                  id="sort-select"
                  value={filters.sort}
                  onChange={(e) => handleSortChange(e.target.value as SortMode)}
                  className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none dark:text-slate-200"
                >
                  <option value="smart">Smart priority</option>
                  <option value="due_date">Due date</option>
                  <option value="priority">Priority</option>
                  <option value="newest">Newest first</option>
                </select>
              </div>
            </div>

            {/* Quick Add Composer */}
            {filters.view !== 'completed' && (
              <div className="mt-4">
                <QuickAdd
                  lists={lists}
                  activeListId={filters.list}
                  view={filters.view}
                  today={today}
                  inputRef={quickAddInputRef}
                />
              </div>
            )}

            {/* Task List */}
            <section className="mt-6 space-y-2.5" aria-label="Task list">
              {todos.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/80 bg-white/60 px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-400">
                    {filters.view === 'completed' ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : (
                      <Sparkles className="h-6 w-6" />
                    )}
                  </div>
                  <h2 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
                    {searchValue
                      ? 'No matching tasks'
                      : filters.view === 'today'
                        ? 'All caught up for today'
                        : filters.view === 'completed'
                          ? 'No completed tasks yet'
                          : 'No tasks here yet'}
                  </h2>
                  <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                    {searchValue
                      ? `No tasks matched "${searchValue}". Try another keyword or clear your search.`
                      : filters.view === 'completed'
                        ? 'Check off a task anywhere in your workspace and it will appear here.'
                        : 'Add a task above to start organizing your work.'}
                  </p>
                  {searchValue && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="mt-4 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-500"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : showSplitSections ? (
                <>
                  <div className="space-y-2.5">
                    {activeTodos.map((todo) => (
                      <TodoItem
                        key={todo.id}
                        todo={todo}
                        today={today}
                        currentSort={filters.sort}
                        onEdit={setEditingTodo}
                      />
                    ))}
                  </div>

                  <div className="pt-4">
                    <div className="mb-2.5 flex items-center gap-2 px-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Completed
                      </span>
                      <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {completedTodos.length}
                      </span>
                      <div className="h-px flex-1 bg-slate-200/80 dark:bg-slate-800" />
                    </div>
                    <div className="space-y-2">
                      {completedTodos.map((todo) => (
                        <TodoItem
                          key={todo.id}
                          todo={todo}
                          today={today}
                          currentSort={filters.sort}
                          onEdit={setEditingTodo}
                        />
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2.5">
                  {todos.map((todo) => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      today={today}
                      currentSort={filters.sort}
                      onEdit={setEditingTodo}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      <EditTodoModal
        todo={editingTodo}
        lists={lists}
        today={today}
        onClose={() => setEditingTodo(null)}
      />

      <ToastContainer />
    </div>
  );
}
