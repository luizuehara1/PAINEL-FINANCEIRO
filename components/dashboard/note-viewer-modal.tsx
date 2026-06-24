"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, FileText, ExternalLink, Download } from "lucide-react";

interface NoteViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  notaUrl: string | null | undefined;
  notaTipo: string | null | undefined;
  notaNome: string | null | undefined;
}

export default function NoteViewerModal({
  isOpen,
  onClose,
  notaUrl,
  notaTipo,
  notaNome
}: NoteViewerModalProps) {
  if (!isOpen || !notaUrl) return null;

  const isImage = (typeStr?: string | null, nameStr?: string | null) => {
    if (!typeStr) {
      if (nameStr) {
        const lower = nameStr.toLowerCase();
        return lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp");
      }
      return false;
    }
    return typeStr.startsWith("image/") || typeStr === "image";
  };

  const imageMode = isImage(notaTipo, notaNome);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", duration: 0.4 }}
          className="bg-zinc-950 border border-emerald-500/20 rounded-2xl w-full max-w-2xl relative shadow-2xl overflow-hidden z-10 flex flex-col"
        >
          {/* Header */}
          <div className="border-b border-white/5 p-4 flex items-center justify-between bg-zinc-900/40">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono truncate max-w-[300px]">
                {notaNome || "Comprovante / Nota Fiscal"}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 flex flex-col items-center justify-center min-h-[250px] max-h-[60vh] overflow-y-auto">
            {imageMode ? (
              <div className="relative rounded-lg overflow-hidden border border-white/5 bg-zinc-900 max-w-full">
                <img
                  src={notaUrl}
                  alt={notaNome || "Nota"}
                  referrerPolicy="no-referrer"
                  className="max-h-[50vh] object-contain max-w-full"
                />
              </div>
            ) : (
              <div className="text-center space-y-4 py-8">
                <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-white/5 text-red-400 flex items-center justify-center mx-auto shadow-lg">
                  <FileText className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white font-mono">Documento PDF</h4>
                  <p className="text-xs text-zinc-500 mt-1">Este comprovante está em formato PDF e não pode ser pré-visualizado diretamente.</p>
                </div>
                <a
                  href={notaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all font-mono"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir PDF em Nova Aba
                </a>
              </div>
            )}
          </div>

          {/* Footer Action Bar */}
          <div className="border-t border-white/5 p-4 flex flex-col sm:flex-row items-center justify-end gap-3 bg-zinc-900/20 shrink-0">
            {imageMode && (
              <a
                href={notaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-black text-white hover:text-emerald-400 font-bold text-xs uppercase tracking-wider rounded-xl border border-white/5 hover:border-emerald-500/20 transition-all font-mono"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir em Nova Aba
              </a>
            )}
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-zinc-800 transition-all font-mono cursor-pointer text-center"
            >
              Fechar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
