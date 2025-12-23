import { useState, ComponentType } from 'react';
import { ErrorOverlay } from './error-overlay';

export function withErrorOverlay<T extends object>(
  Component: ComponentType<T>
) {
  function WrappedComponent(props: T) {
    const [error, setError] = useState<{
      message: string;
      stack?: string;
      file?: string;
      line?: number;
      column?: number;
    } | null>(null);

    // Listen for Vite HMR errors
    if (import.meta.hot) {
      import.meta.hot.on('vite:error', (data) => {
        setError({
          message: data.err?.message || 'Unknown error',
          stack: data.err?.stack,
          file: data.err?.loc?.file,
          line: data.err?.loc?.line,
          column: data.err?.loc?.column,
        });
      });

      // Clear error when HMR updates successfully
      import.meta.hot.on('vite:beforeUpdate', () => {
        setError(null);
      });
    }

    return (
      <>
        <Component {...props} />
        {error && <ErrorOverlay error={error} onClose={() => setError(null)} />}
      </>
    );
  }

  WrappedComponent.displayName = `withErrorOverlay(${
    Component.displayName || Component.name
  })`;

  return WrappedComponent;
}
