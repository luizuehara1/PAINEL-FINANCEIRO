import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, CheckCircle, HelpCircle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "success" | "default";
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={loading ? undefined : onCancel}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
          >
            {/* Close button */}
            {!loading && (
              <button
                type="button"
                onClick={onCancel}
                className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Content header */}
            <div className="flex items-start gap-4">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                  variant === "danger"
                    ? "border-red-500/20 bg-red-500/10 text-red-400"
                    : variant === "success"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    : "border-zinc-800 bg-zinc-900/50 text-zinc-400"
                }`}
              >
                {variant === "danger" ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : variant === "success" ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <HelpCircle className="h-5 w-5" />
                )}
              </div>

              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {title}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {description}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={onCancel}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all disabled:opacity-50"
              >
                {cancelText}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirm();
                }}
                className={`rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                  variant === "danger"
                    ? "bg-red-600 hover:bg-red-500 shadow-red-900/10"
                    : variant === "success"
                    ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/10"
                    : "bg-zinc-100 text-zinc-950 hover:bg-white"
                }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-current" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Carregando...</span>
                  </>
                ) : (
                  confirmText
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
