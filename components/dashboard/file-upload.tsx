"use client";

import React, { useRef, useState } from "react";
import { Upload, FileText, Trash2, Eye, Loader2 } from "lucide-react";

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  onFileRemove: () => void;
  selectedFile: File | null;
  existingNoteUrl?: string | null;
  existingNoteName?: string | null;
  existingNoteTipo?: string | null;
  onRemoveExistingNote?: () => void;
  isLoading?: boolean;
}

export default function FileUpload({
  onFileSelect,
  onFileRemove,
  selectedFile,
  existingNoteUrl,
  existingNoteName,
  existingNoteTipo,
  onRemoveExistingNote,
  isLoading = false
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Handle Drag Over / Leave
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Process selected file
  const processFile = (file: File) => {
    // Add console log for testing file metadata without content
    console.log("Arquivo selecionado:", file.name, file.size, file.type);

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf"
    ];

    if (!allowedTypes.includes(file.type)) {
      alert("Formato de arquivo inválido. Apenas imagens (JPG, PNG, WEBP) e PDF são permitidos.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert("O tamanho do arquivo não pode passar de 50MB.");
      return;
    }

    onFileSelect(file);

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  // Drop Handler
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Input Change Handler
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Click Trigger
  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Remove Handler
  const handleClear = () => {
    onFileRemove();
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isImage = (typeStr?: string | null, nameStr?: string | null) => {
    if (!typeStr) {
      if (nameStr) {
        const lower = nameStr.toLowerCase();
        return lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp");
      }
      return false;
    }
    return typeStr.startsWith("image/");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col">
        <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">Nota ou comprovante</span>
        <span className="text-[10px] text-zinc-500">Opcional — anexe uma imagem ou PDF de até 50MB.</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
        onChange={handleChange}
        disabled={isLoading}
      />

      {/* DRAG AND DROP CONTAINER */}
      {!selectedFile && !existingNoteUrl && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={onButtonClick}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
            dragActive
              ? "border-emerald-500 bg-emerald-500/5"
              : "border-zinc-800 hover:border-emerald-500/30 bg-zinc-950/40 hover:bg-zinc-900/20"
          }`}
        >
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-white/5 text-zinc-400">
              <Upload className="w-4 h-4 text-zinc-400" />
            </div>
            <p className="text-xs text-zinc-300 font-semibold">
              Arraste e solte o comprovante aqui ou clique para selecionar
            </p>
            <p className="text-[10px] text-zinc-500 font-medium font-mono">
              Suporta JPG, PNG, WEBP e PDF
            </p>
          </div>
        </div>
      )}

      {/* NEW FILE PREVIEW */}
      {selectedFile && (
        <div className="rounded-xl border border-white/5 bg-zinc-900/60 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            {previewUrl ? (
              <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-black flex items-center justify-center">
                <img src={previewUrl} alt="Comprovante" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg bg-red-950/20 border border-red-500/10 shrink-0 flex items-center justify-center text-red-400">
                <FileText className="w-8 h-8" />
              </div>
            )}
            <div className="text-left overflow-hidden">
              <p className="text-xs text-white font-bold truncate max-w-[200px]">{selectedFile.name}</p>
              <p className="text-[10px] text-zinc-500 font-mono">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type || "PDF"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClear}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-red-400 hover:text-white hover:bg-red-500/10 rounded-lg border border-red-500/20 transition-all cursor-pointer w-full md:w-auto justify-center"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remover Arquivo
          </button>
        </div>
      )}

      {/* EXISTING FILE VIEW */}
      {!selectedFile && existingNoteUrl && (
        <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            {isImage(existingNoteTipo, existingNoteName) ? (
              <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-black flex items-center justify-center">
                <img src={existingNoteUrl} alt="Nota atual" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg bg-red-950/20 border border-red-500/10 shrink-0 flex items-center justify-center text-red-400">
                <FileText className="w-8 h-8" />
              </div>
            )}
            <div className="text-left overflow-hidden">
              <p className="text-xs text-white font-bold truncate max-w-[200px]">{existingNoteName || "Comprovante Atual"}</p>
              <span className="inline-block text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 font-mono">
                Anexo Salvo
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto shrink-0">
            <a
              href={existingNoteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-zinc-300 hover:text-emerald-400 bg-zinc-900 hover:bg-black rounded-lg border border-white/5 hover:border-emerald-500/20 transition-all text-center justify-center"
            >
              <Eye className="w-3.5 h-3.5" />
              Visualizar
            </a>
            {onRemoveExistingNote && (
              <button
                type="button"
                onClick={onRemoveExistingNote}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-red-400 hover:text-white hover:bg-red-500/10 rounded-lg border border-red-500/20 transition-all cursor-pointer justify-center"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remover Nota
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
