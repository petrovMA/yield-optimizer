import * as React from 'react';
import { X, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface ErrorOverlayProps {
  error: {
    message: string;
    stack?: string;
    file?: string;
    line?: number;
    column?: number;
  };
  onClose: () => void;
}

export function ErrorOverlay({ error, onClose }: ErrorOverlayProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md">
      <div className="fixed inset-4 z-50 max-w-md mx-auto my-20 rounded-lg border-2 border-[#00f3ff]/50 bg-gradient-to-br from-black/95 via-[#1a0a2e]/90 to-black/95 p-6 shadow-[0_0_30px_rgba(0,243,255,0.3)]" style={{ backdropFilter: 'blur(20px)' }}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[#ff0055] drop-shadow-[0_0_8px_rgba(255,0,85,0.8)]" />
            <h2 className="text-lg font-semibold text-[#00f3ff] drop-shadow-[0_0_10px_rgba(0,243,255,0.6)]">Something went wrong</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 transition-all hover:opacity-100 hover:text-[#00f3ff] hover:drop-shadow-[0_0_8px_rgba(0,243,255,0.8)] focus:outline-none"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-gray-300">
            The app encountered an issue while updating.
          </p>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#00f3ff] hover:drop-shadow-[0_0_6px_rgba(0,243,255,0.6)] transition-all"
          >
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showDetails ? 'Hide' : 'Show'} technical details
          </button>

          {showDetails && (
            <div className="space-y-3 pt-2 border-t border-[#00f3ff]/30">
              {error.file && (
                <div className="text-sm text-gray-300">
                  <span className="font-medium text-[#0aff00]">File:</span> {error.file}
                  {error.line && (
                    <span className="text-gray-400">
                      :{error.line}
                      {error.column && `:${error.column}`}
                    </span>
                  )}
                </div>
              )}

              <div>
                <h3 className="mb-2 font-medium text-sm text-[#0aff00]">Error Message:</h3>
                <div className="rounded-md bg-black/60 border border-[#ff0055]/30 p-3 font-mono text-xs text-gray-200">
                  {error.message}
                </div>
              </div>

              {error.stack && (
                <div>
                  <h3 className="mb-2 font-medium text-sm text-[#0aff00]">Stack Trace:</h3>
                  <div className="max-h-32 overflow-auto rounded-md bg-black/60 border border-[#ff0055]/30 p-3 font-mono text-xs text-gray-200">
                    <pre className="whitespace-pre-wrap">{error.stack}</pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
