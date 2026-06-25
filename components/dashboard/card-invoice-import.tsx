"use client";

import React, { useState, useRef } from "react";
import { Upload, File, AlertCircle, RefreshCw, X, HelpCircle, FileSpreadsheet, FileText, CheckCircle2 } from "lucide-react";
import { ImportInvoiceResult } from "@/types/finance";

interface CardInvoiceImportProps {
  onParsed: (result: ImportInvoiceResult, fileName: string) => void;
  onCancel: () => void;
}

export default function CardInvoiceImport({ onParsed, onCancel }: CardInvoiceImportProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);

    try {
      const { parseCardInvoiceFile } = await import("@/lib/card-import-parser");
      const result = await parseCardInvoiceFile(file);
      if (!result.items || result.items.length === 0) {
        throw new Error(
          "Nenhum lançamento financeiro foi identificado no arquivo. Verifique o formato ou envie outro arquivo."
        );
      }

      onParsed(result, file.name);
    } catch (err: any) {
      console.error("Erro ao analisar fatura:", err);
      setError(err.message || "Erro ao ler ou processar o arquivo de fatura. Verifique a integridade do arquivo.");
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div className="bg-zinc-950 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-white/5">
        <div>
          <h3 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-400" />
            Importar Fatura de Cartão
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Suporta múltiplos formatos de arquivo: CSV (Sicredi ou genérico), PDF, Excel (XLS/XLSX) e OFX.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 rounded-lg bg-zinc-900 border border-white/5 hover:border-white/10 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5 animate-pulse" />
          <div className="space-y-1">
            <span className="font-bold">Falha na importação</span>
            <p className="text-zinc-300 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 space-y-4 rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/10">
          <div className="p-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <RefreshCw className="w-8 h-8 animate-spin" />
          </div>
          <div className="text-center space-y-1">
            <h4 className="text-sm font-bold text-white">Analisando faturas...</h4>
            <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
              Identificando colunas automaticamente, extraindo lançamentos, mapeando parcelas e sugerindo categorias inteligentes.
            </p>
          </div>
        </div>
      ) : (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center py-16 px-4 space-y-4 rounded-3xl border border-dashed transition-all cursor-pointer ${
            isDragActive
              ? "border-emerald-500 bg-emerald-500/5 text-emerald-400"
              : "border-zinc-800 bg-zinc-900/10 hover:bg-zinc-900/20 hover:border-emerald-500/20 text-zinc-400"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleInputChange}
            accept=".pdf,.csv,.xls,.xlsx,.ofx"
            className="hidden"
          />
          <div className="p-4 rounded-2xl bg-zinc-900 border border-white/5 shadow-inner">
            <div className="flex gap-1.5 justify-center items-center">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
              <FileText className="w-6 h-6 text-emerald-500" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h4 className="text-sm font-bold text-white">Arraste seu arquivo aqui ou clique para buscar</h4>
            <p className="text-xs text-zinc-500 max-w-sm leading-relaxed mx-auto">
              Selecione arquivos <span className="text-zinc-300 font-bold">.CSV</span>, <span className="text-zinc-300 font-bold">.PDF</span>, <span className="text-zinc-300 font-bold">.XLSX</span>, <span className="text-zinc-300 font-bold">.XLS</span> ou <span className="text-zinc-300 font-bold">.OFX</span>.
            </p>
          </div>
        </div>
      )}

      {/* Helpful Tips / Formats list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-zinc-900/30 border border-white/5 flex gap-3.5 items-start">
          <HelpCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <span className="font-bold text-zinc-200">Formatos de Importação</span>
            <ul className="text-zinc-400 space-y-1 mt-1 list-disc list-inside">
              <li><strong className="text-zinc-300">CSV Sicredi:</strong> Formato nativo com aspas e ponto e vírgula.</li>
              <li><strong className="text-zinc-300">XLSX/XLS:</strong> Planilhas do Excel contendo colunas de transações.</li>
              <li><strong className="text-zinc-300">OFX:</strong> Extrato de cartão com tags padronizadas.</li>
              <li><strong className="text-zinc-300">PDF:</strong> Extrato de faturas nubank, itaú, sicredi, inter, etc.</li>
            </ul>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/30 border border-white/5 flex gap-3.5 items-start">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <span className="font-bold text-zinc-200">Processamento e Destinos</span>
            <p className="text-zinc-400 leading-relaxed">
              O leitor classifica os lançamentos positivos como compras comuns e sugere os destinos (Fixa ou Variável). Lançamentos de valores negativos são marcados como Crédito/Estorno ou Pagamento e não geram despesas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
