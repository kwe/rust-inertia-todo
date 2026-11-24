import '../css/app.css';
import { createInertiaApp } from '@inertiajs/react';
import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';

type PageModule = {
  default: ComponentType<Record<string, unknown>>;
};

createInertiaApp({
  resolve: (name) => {
    const pages = import.meta.glob<PageModule>('./pages/**/*.tsx', { eager: true });
    const page = pages[`./pages/${name}.tsx`];
    if (!page) {
      throw new Error(`Inertia page not found: ./pages/${name}.tsx`);
    }
    return page.default;
  },
  setup({ el, App, props }) {
    createRoot(el).render(<App {...props} />);
  },
  progress: {
    color: '#6366f1',
    showSpinner: false,
  },
});
