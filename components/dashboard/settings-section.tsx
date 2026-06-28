"use client";

import React from "react";
import { Settings, HelpCircle } from "lucide-react";
import CategoryManager from "./category-manager";
import PaymentMethodManager from "./payment-method-manager";
import PropertyManager from "./property-manager";
import ResetFinanceData from "./reset-finance-data";
import DataRecoveryPanel from "./data-recovery-panel";
import DataAuditPanel from "./data-audit-panel";
import RecurringRepairPanel from "./recurring-repair-panel";

interface SettingsSectionProps {
  userEmail: string;
}

export default function SettingsSection({ userEmail }: SettingsSectionProps) {
  return (
    <div className="space-y-6" id="settings-section">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/25 text-emerald-400">
              <Settings className="w-5 h-5 animate-spin-slow" />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight font-mono">
              Cadastros do Sistema
            </h1>
          </div>
          <p className="text-xs text-zinc-400">
            Gerencie categorias e formas de pagamento usadas nos lançamentos financeiros.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-900/30 border border-white/5 px-4 py-2.5 rounded-xl">
          <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>As alterações nestas tabelas refletem imediatamente nos formulários de cadastro.</span>
        </div>
      </div>

      {/* Auditoria dos Dados Panel */}
      <DataAuditPanel />

      {/* Diagnóstico e Reparo de Recorrências */}
      <RecurringRepairPanel />

      {/* Grid Layout of Managers */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Row 1, Col 1: Categorias de Entrada */}
        <CategoryManager
          collectionName="categoriasEntrada"
          title="Categorias de Entrada"
          subtitle="Classifique os fluxos de faturamento, vendas e aportes."
          userEmail={userEmail}
        />

        {/* Row 1, Col 2: Categorias de Saída */}
        <CategoryManager
          collectionName="categoriasSaida"
          title="Categorias de Saída"
          subtitle="Classifique as despesas operacionais gerais de saída."
          userEmail={userEmail}
        />

        {/* Row 2, Col 1: Categorias de Despesas Fixas */}
        <CategoryManager
          collectionName="categoriasDespesasFixas"
          title="Categorias de Despesas Fixas"
          subtitle="Classifique as obrigações e compromissos mensais fixos."
          userEmail={userEmail}
        />

        {/* Row 2, Col 1: Categorias de Despesas Variáveis */}
        <CategoryManager
          collectionName="categoriasDespesasVariaveis"
          title="Categorias de Despesas Variáveis"
          subtitle="Classifique despesas flutuantes, pontuais ou esporádicas."
          userEmail={userEmail}
        />

        {/* Full width (xl:col-span-2) for Properties / Cost Centers */}
        <div className="xl:col-span-2">
          <PropertyManager userEmail={userEmail} />
        </div>

        {/* Full width (xl:col-span-2) for Payment Methods */}
        <div className="xl:col-span-2">
          <PaymentMethodManager userEmail={userEmail} />
        </div>

        {/* Full width (xl:col-span-2) for Data Recovery */}
        <div className="xl:col-span-2 pt-4">
          <DataRecoveryPanel />
        </div>

        {/* Full width (xl:col-span-2) for Maintenance Zone */}
        <div className="xl:col-span-2 pt-4">
          <ResetFinanceData userEmail={userEmail} />
        </div>
      </div>
    </div>
  );
}
