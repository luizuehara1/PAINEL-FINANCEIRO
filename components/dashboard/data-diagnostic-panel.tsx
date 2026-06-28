"use client";

import React, { useState, useEffect } from "react";
import { 
  Terminal, 
  RefreshCw, 
  AlertTriangle, 
  Eye, 
  Filter, 
  HelpCircle,
  Clock,
  Database,
  Trash2,
  CheckCircle2
} from "lucide-react";
import { DIAGNOSTICS_REGISTRY, DiagnosticInfo } from "@/lib/data-source";
import { COMPANY_ID } from "@/lib/app-config";

export default function DataDiagnosticPanel() {
  const [data, setData] = useState<Record<string, DiagnosticInfo>>({});
  const [lastReload, setLastReload] = useState<string>("");

  const loadData = () => {
    setData({ ...DIAGNOSTICS_REGISTRY });
    setLastReload(new Date().toLocaleTimeString());
  };

  useEffect(() => {
    loadData();
    // Auto refresh every 5 seconds
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const sections = Object.values(data) as DiagnosticInfo[];

  return (
    <div className="bg-zinc-950 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6" id="data-diagnostic-panel-container">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            Painel de Diagnóstico Real-Time
          </h2>
        </div>
        <button
          onClick={loadData}
          className="p-1.5 hover:bg-zinc-900 border border-white/5 rounded-lg text-zinc-400 hover:text-white transition-all flex items-center gap-1.5 text-xs font-mono"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
          Atualizar
        </button>
      </div>

      <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
        Abaixo estão os detalhes de carregamento e as regras de filtragem aplicadas ativamente pelas abas do seu dashboard. Esses logs auxiliam a auditar a rastreabilidade e integridade das consultas ao Firestore.
      </p>

      {sections.length === 0 ? (
        <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6 text-center text-xs text-zinc-500">
          Nenhuma consulta registrada ainda. Navegue entre as seções para alimentar o sistema de diagnóstico.
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((sec) => {
            const hasIgnored = sec.ignoredDocs && sec.ignoredDocs.length > 0;
            return (
              <div 
                key={sec.sectionName} 
                className={`bg-zinc-900/40 border rounded-2xl p-5 space-y-4 transition-all ${
                  hasIgnored ? "border-amber-500/15" : "border-white/5"
                }`}
              >
                {/* Section Header info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold font-mono text-zinc-500 uppercase block">Aba / Componente</span>
                    <h3 className="text-sm font-bold text-white">{sec.sectionName}</h3>
                  </div>
                  
                  <div className="flex items-center gap-2 font-mono text-[10px]">
                    <span className="bg-zinc-950 px-2 py-1 border border-white/5 rounded-md text-zinc-400">
                      Coleção: <strong className="text-emerald-400">{sec.collectionName}</strong>
                    </span>
                    <span className="bg-zinc-950 px-2 py-1 border border-white/5 rounded-md text-zinc-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      {sec.lastUpdated}
                    </span>
                  </div>
                </div>

                {/* Filters details */}
                <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                  {sec.filtersApplied.map((f, i) => (
                    <span key={i} className="px-2 py-0.5 bg-zinc-950 border border-white/5 text-zinc-500 rounded-md flex items-center gap-1">
                      <Filter className="w-2.5 h-2.5 text-emerald-500/50" />
                      {f}
                    </span>
                  ))}
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20">
                    ID Painel: {COMPANY_ID}
                  </span>
                </div>

                {/* Metrics counts row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-zinc-950/60 border border-white/5 rounded-xl px-4 py-3 text-center">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">Lidos Firestore</span>
                    <strong className="text-lg text-white font-mono">{sec.loadedCount}</strong>
                  </div>
                  <div className="bg-zinc-950/60 border border-white/5 rounded-xl px-4 py-3 text-center">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">Exibidos na Tela</span>
                    <strong className="text-lg text-emerald-400 font-mono">{sec.displayedCount}</strong>
                  </div>
                  <div className={`border rounded-xl px-4 py-3 text-center col-span-2 sm:col-span-1 ${
                    hasIgnored ? "bg-amber-500/5 border-amber-500/10 text-amber-400" : "bg-zinc-950/60 border border-white/5 text-zinc-500"
                  }`}>
                    <span className="text-[9px] font-bold uppercase tracking-wider block font-mono">Ignorados / Erros</span>
                    <strong className="text-lg font-mono flex items-center justify-center gap-1.5">
                      {hasIgnored && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                      {sec.ignoredDocs?.length || 0}
                    </strong>
                  </div>
                </div>

                {/* Ignored document logs */}
                {hasIgnored && (
                  <div className="bg-zinc-950 border border-amber-500/10 rounded-xl p-4 space-y-2">
                    <span className="text-[10px] font-bold font-mono text-amber-400 uppercase tracking-wider block">
                      LOGS de Documentos Ignorados nesta seção
                    </span>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {sec.ignoredDocs.map((ig, i) => (
                        <div key={i} className="text-[11px] font-mono text-zinc-400 flex items-start gap-2 bg-zinc-900/30 px-2.5 py-1.5 rounded-lg border border-white/5">
                          <span className="px-1.5 py-0.5 bg-zinc-950 text-amber-400/80 border border-amber-500/15 rounded text-[9px] shrink-0 font-bold uppercase">
                            ID: {ig.id.substring(0, 6)}...
                          </span>
                          <span className="text-zinc-300">
                            Motivo: <strong className="text-amber-500 font-medium">{ig.reason}</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
