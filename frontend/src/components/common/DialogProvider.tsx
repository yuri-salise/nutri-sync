import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Overlay } from './Overlay';

/**
 * In-app replacements for window.confirm / window.prompt / window.alert.
 * Each call returns a promise, so call sites read the same as the browser versions:
 *
 *   const { confirm, prompt, alert } = useDialogs();
 *   if (!(await confirm({ title: 'Delete?', tone: 'danger' }))) return;
 */

export interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" styles the confirm button red and focuses Cancel first. */
  tone?: 'default' | 'danger';
}

export interface PromptOptions {
  title: string;
  message?: React.ReactNode;
  label: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  maxLength?: number;
  /** Return an error message to block submit, or null when the value is fine. */
  validate?: (value: string) => string | null;
}

export interface AlertOptions {
  title: string;
  message?: React.ReactNode;
  okLabel?: string;
}

type Request =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void }
  | { kind: 'alert'; opts: AlertOptions; resolve: () => void };

interface DialogApi {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
  alert: (opts: AlertOptions) => Promise<void>;
}

const DialogContext = createContext<DialogApi | null>(null);

export const useDialogs = (): DialogApi => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialogs must be used inside <DialogProvider>');
  return ctx;
};

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], select, textarea, [tabindex]:not([tabindex="-1"])';

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<Request[]>([]);

  const enqueue = useCallback(<T,>(make: (resolve: (v: T) => void) => Request) => {
    return new Promise<T>((resolve) => setQueue((q) => [...q, make(resolve)]));
  }, []);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (opts) => enqueue<boolean>((resolve) => ({ kind: 'confirm', opts, resolve })),
      prompt: (opts) => enqueue<string | null>((resolve) => ({ kind: 'prompt', opts, resolve })),
      alert: (opts) => enqueue<void>((resolve) => ({ kind: 'alert', opts, resolve: () => resolve() })),
    }),
    [enqueue]
  );

  const current = queue[0];
  const close = () => setQueue((q) => q.slice(1));

  return (
    <DialogContext.Provider value={api}>
      {children}
      {current && <DialogView key={queue.length + current.kind + String(current.opts.title)} request={current} onClose={close} />}
    </DialogContext.Provider>
  );
};

const DialogView: React.FC<{ request: Request; onClose: () => void }> = ({ request, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [value, setValue] = useState(request.kind === 'prompt' ? request.opts.initialValue ?? '' : '');
  const [error, setError] = useState<string | null>(null);

  const cancel = () => {
    if (request.kind === 'confirm') request.resolve(false);
    else if (request.kind === 'prompt') request.resolve(null);
    else request.resolve();
    onClose();
  };

  const accept = () => {
    if (request.kind === 'confirm') {
      request.resolve(true);
    } else if (request.kind === 'prompt') {
      const trimmed = value.trim();
      const problem = request.opts.validate?.(trimmed) ?? (trimmed ? null : 'Please enter a value.');
      if (problem) {
        setError(problem);
        inputRef.current?.focus();
        return;
      }
      request.resolve(trimmed);
    } else {
      request.resolve();
    }
    onClose();
  };

  // Focus the safest control first, give focus back afterwards, keep the page from scrolling.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (request.kind === 'prompt') {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (request.kind === 'confirm' && request.opts.tone === 'danger') {
      cancelRef.current?.focus();
    } else {
      confirmRef.current?.focus();
    }
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      cancel();
      return;
    }
    if (e.key === 'Tab' && panelRef.current) {
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const danger = request.kind === 'confirm' && request.opts.tone === 'danger';
  const title = request.opts.title;
  const message = 'message' in request.opts ? request.opts.message : undefined;
  const confirmLabel =
    request.kind === 'confirm'
      ? request.opts.confirmLabel ?? (danger ? 'Delete' : 'Confirm')
      : request.kind === 'prompt'
      ? request.opts.confirmLabel ?? 'Save'
      : request.opts.okLabel ?? 'OK';
  const cancelLabel = request.kind === 'confirm' ? request.opts.cancelLabel ?? 'Cancel' : 'Cancel';

  return (
    <Overlay>
      <div
        className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
        onKeyDown={onKeyDown}
      >
        <div className="absolute inset-0 bg-black/75" onClick={cancel} aria-hidden="true" />
        <div
          ref={panelRef}
          role={request.kind === 'prompt' ? 'dialog' : 'alertdialog'}
          aria-modal="true"
          aria-labelledby="dialog-title"
          aria-describedby={message ? 'dialog-message' : undefined}
          className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[#0d1015] border border-[#1e232d] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4 shadow-2xl"
        >
          <div className="flex items-start gap-3">
            <div
              className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${
                danger ? 'bg-[#F6465D]/15 text-[#F6465D]' : 'bg-[#C8FF00]/15 text-[#C8FF00]'
              }`}
            >
              {danger ? <AlertTriangle className="h-5 w-5" /> : <Info className="h-5 w-5" />}
            </div>
            <div className="min-w-0 space-y-1">
              <h2 id="dialog-title" className="text-lg font-bold text-white break-words">
                {title}
              </h2>
              {message && (
                <div id="dialog-message" className="text-sm text-[#B7BDC6] break-words">
                  {message}
                </div>
              )}
            </div>
          </div>

          {request.kind === 'prompt' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                accept();
              }}
              className="space-y-1.5"
            >
              <label htmlFor="dialog-input" className="text-sm text-[#848E9C]">
                {request.opts.label}
              </label>
              <input
                id="dialog-input"
                ref={inputRef}
                value={value}
                maxLength={request.opts.maxLength ?? 120}
                placeholder={request.opts.placeholder}
                aria-invalid={!!error}
                aria-describedby={error ? 'dialog-error' : undefined}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                className="w-full h-12 rounded-xl bg-[#07080a] border border-[#1e232d] px-3 text-base text-white placeholder-[#848E9C] focus:border-[#C8FF00] focus:outline-none"
              />
              {error && (
                <p id="dialog-error" role="alert" className="text-sm text-[#F6465D]">
                  {error}
                </p>
              )}
            </form>
          )}

          <div className={`grid gap-3 ${request.kind === 'alert' ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {request.kind !== 'alert' && (
              <button
                ref={cancelRef}
                type="button"
                onClick={cancel}
                className="h-12 rounded-2xl bg-[#12151b] border border-[#1e232d] text-white font-semibold text-sm hover:border-[#2a313f]"
              >
                {cancelLabel}
              </button>
            )}
            <button
              ref={confirmRef}
              type="button"
              onClick={accept}
              className={`h-12 rounded-2xl font-bold text-sm ${
                danger ? 'bg-[#F6465D] text-white' : 'bg-[#C8FF00] text-black'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
};
