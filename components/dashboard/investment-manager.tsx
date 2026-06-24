"use client";

import React, { useState, useEffect } from "react";
import { Investment, BankAccount, InvestmentMovement } from "@/types/finance";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp,
  query,
  where,
  orderBy,
  onSnapshot
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  DollarSign, 
  Power, 
  History, 
  ShieldCheck, 
  PiggyBank 
} from "lucide-react";
import { InvestmentRedeemModal } from "./investment-redeem-modal";

interface InvestmentManagerProps {
  investments: Investment[];
  banks: BankAccount[];
  userEmail: string;
}

export function InvestmentManager({ investments, banks, userEmail }: InvestmentManagerProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);

  // Form states
  const [nome, setNome] = useState("");
  const [tipoInvestimento, setTipoInvestimento] = useState<Investment["tipoInvestimento"]>("renda_fixa");
  const [instituicao, setInstituicao] = useState("");
  const [valorAtual, setValorAtual] = useState("");
  const [valorInicial, setValorInicial] = useState("");
  const [dataAplicacao, setDataAplicacao] = useState(new Date().toISOString().split("T")[0]);
  const [rentabilidade, setRentabilidade] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ativo, setAtivo] = useState(true);

  // Redeem modal state
  const [redeemingInvestment, setRedeemingInvestment] = useState<Investment | null>(null);

  // History state
  const [selectedHistInvestmentId, setSelectedHistInvestmentId] = useState<string | null>(null);
  const [movements, setMovements] = useState<InvestmentMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  // Load movements for selected investment history
  useEffect(() => {
    if (!selectedHistInvestmentId) {
      setMovements([]);
      return;
    }

    setLoadingMovements(true);
    const path = "financeiro/geral/movimentacoesInvestimentos";
    const q = query(
      collection(db, path),
      where("investimentoId", "==", selectedHistInvestmentId),
      orderBy("data", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: InvestmentMovement[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as InvestmentMovement);
      });
      setMovements(list);
      setLoadingMovements(false);
    }, (error) => {
      console.error("Erro ao carregar movimentações:", error);
      setLoadingMovements(false);
    });

    return () => unsub();
  }, [selectedHistInvestmentId]);

  const handleOpenCreate = () => {
    setEditingInvestment(null);
    setNome("");
    setTipoInvestimento("renda_fixa");
    setInstituicao("");
    setValorAtual("");
    setValorInicial("");
    setDataAplicacao(new Date().toISOString().split("T")[0]);
    setRentabilidade("");
    setDescricao("");
    setAtivo(true);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (inv: Investment) => {
    setEditingInvestment(inv);
    setNome(inv.nome);
    setTipoInvestimento(inv.tipoInvestimento);
    setInstituicao(inv.instituicao);
    setValorAtual(String(inv.valorAtual));
    setValorInicial(String(inv.valorInicial));
    
    let dateStr = new Date().toISOString().split("T")[0];
    if (inv.dataAplicacao) {
      const d = inv.dataAplicacao.toDate ? inv.dataAplicacao.toDate() : new Date(inv.dataAplicacao);
      if (!isNaN(d.getTime())) {
        dateStr = d.toISOString().split("T")[0];
      }
    }
    setDataAplicacao(dateStr);
    setRentabilidade(inv.rentabilidade ? String(inv.rentabilidade) : "");
    setDescricao(inv.descricao || "");
    setAtivo(inv.ativo);
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !instituicao) {
      alert("Por favor, preencha os campos obrigatórios (Nome do investimento e Instituição).");
      return;
    }

    const valAtual = parseFloat(valorAtual.replace(",", "."));
    const valInicial = parseFloat(valorInicial.replace(",", "."));
    if (isNaN(valAtual) || isNaN(valInicial)) {
      alert("Por favor, preencha valores monetários válidos.");
      return;
    }

    const rent = rentabilidade ? parseFloat(rentabilidade.replace(",", ".")) : null;

    // Convert date string safely to Timestamp
    const [y, m, d] = dataAplicacao.split("-").map(Number);
    const appDate = Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));

    const path = "financeiro/geral/investimentos";
    try {
      if (editingInvestment) {
        const invRef = doc(db, path, editingInvestment.id);
        await updateDoc(invRef, {
          nome,
          tipoInvestimento,
          instituicao,
          valorAtual: valAtual,
          valorInicial: valInicial,
          dataAplicacao: appDate,
          rentabilidade: rent,
          descricao,
          ativo,
          atualizadoEm: Timestamp.now()
        });
      } else {
        const newDocRef = await addDoc(collection(db, path), {
          nome,
          tipoInvestimento,
          instituicao,
          valorAtual: valAtual,
          valorInicial: valInicial,
          dataAplicacao: appDate,
          rentabilidade: rent,
          descricao,
          ativo,
          criadoEm: Timestamp.now(),
          atualizadoEm: Timestamp.now(),
          criadoPorEmail: userEmail
        });

        // Register initial aporte movement
        const movePath = "financeiro/geral/movimentacoesInvestimentos";
        await addDoc(collection(db, movePath), {
          investimentoId: newDocRef.id,
          tipo: "aporte",
          valor: valInicial,
          data: appDate,
          bancoDestinoId: null,
          descricao: "Aporte inicial na criação do investimento",
          criadoEm: Timestamp.now(),
          criadoPorEmail: userEmail
        });
      }
      setIsFormOpen(false);
      setEditingInvestment(null);
    } catch (error) {
      handleFirestoreError(error, editingInvestment ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const handleDelete = async (inv: Investment) => {
    if (!confirm(`Tem certeza que deseja excluir o investimento "${inv.nome}"? Seu histórico e registros serão excluídos.`)) {
      return;
    }
    const path = "financeiro/geral/investimentos";
    try {
      await deleteDoc(doc(db, path, inv.id));
      if (selectedHistInvestmentId === inv.id) {
        setSelectedHistInvestmentId(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleToggleAtivo = async (inv: Investment) => {
    const path = "financeiro/geral/investimentos";
    try {
      await updateDoc(doc(db, path, inv.id), {
        ativo: !inv.ativo,
        atualizadoEm: Timestamp.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const getInvestmentTypeLabel = (type: Investment["tipoInvestimento"]) => {
    switch (type) {
      case "renda_fixa": return "Renda Fixa";
      case "renda_variavel": return "Renda Variável";
      case "tesouro": return "Tesouro Direto";
      case "acoes": return "Ações";
      case "fii": return "FIIs (Imobiliários)";
      case "cripto": return "Criptoativos";
      case "fundo": return "Fundos de Invest.";
      default: return "Outros";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
          <PiggyBank className="w-4 h-4 text-emerald-400" />
          Carteira de Investimentos ({investments.length})
        </h3>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Novo Investimento
        </button>
      </div>

      {/* Grid listing */}
      {investments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/10 space-y-3">
          <TrendingUp className="w-8 h-8 text-zinc-600" />
          <p className="text-xs text-zinc-500 font-medium">Nenhum investimento cadastrado ainda.</p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-bold transition-all underline cursor-pointer"
          >
            Cadastrar primeiro investimento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {investments.map((inv) => {
            const pct = inv.valorInicial > 0 ? ((inv.valorAtual - inv.valorInicial) / inv.valorInicial) * 100 : 0;
            const hasYield = pct !== 0;
            const yieldColor = pct >= 0 ? "text-emerald-400" : "text-red-400";
            const appDateStr = inv.dataAplicacao?.toDate 
              ? inv.dataAplicacao.toDate().toLocaleDateString("pt-BR") 
              : new Date(inv.dataAplicacao).toLocaleDateString("pt-BR");

            return (
              <div
                key={inv.id}
                className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between h-56 relative overflow-hidden group ${
                  inv.ativo 
                    ? "border-white/5 bg-zinc-900/10 hover:border-emerald-500/20 hover:bg-zinc-900/20" 
                    : "border-white/5 bg-zinc-900/50 opacity-60"
                }`}
              >
                {/* Visual decorations */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-all" />

                {/* Top line: Metadata & Action buttons */}
                <div className="flex justify-between items-start z-10">
                  <div>
                    <span className="text-[9px] font-bold text-zinc-500 font-mono uppercase bg-zinc-900 border border-white/5 px-2 py-0.5 rounded-md">
                      {inv.instituicao}
                    </span>
                    <h4 className="text-sm font-bold text-white mt-1.5 group-hover:text-emerald-300 transition-colors">
                      {inv.nome}
                    </h4>
                  </div>

                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleAtivo(inv)}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        inv.ativo 
                          ? "bg-zinc-950 border-white/5 text-emerald-400 hover:bg-zinc-900" 
                          : "bg-zinc-950 border-white/5 text-zinc-500 hover:bg-zinc-900"
                      }`}
                      title={inv.ativo ? "Desativar investimento" : "Ativar investimento"}
                    >
                      <Power className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(inv)}
                      className="p-1.5 rounded-lg bg-zinc-950 border border-white/5 text-zinc-400 hover:text-white transition-all cursor-pointer"
                      title="Editar"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(inv)}
                      className="p-1.5 rounded-lg bg-zinc-950 border border-white/5 text-zinc-400 hover:text-red-400 transition-all cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Subtitle / category */}
                <div className="z-10 text-[11px] text-zinc-400 font-mono font-medium -mt-1 flex items-center gap-1">
                  <span>{getInvestmentTypeLabel(inv.tipoInvestimento)}</span>
                  <span>•</span>
                  <span>Aplicado em {appDateStr}</span>
                </div>

                {/* Mid portion: Balances */}
                <div className="z-10 grid grid-cols-2 gap-4 border-y border-white/5 py-2.5 my-1 text-xs">
                  <div>
                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Valor Aplicado</span>
                    <span className="font-semibold text-zinc-300 font-mono block">
                      R$ {inv.valorInicial.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Valor Atual</span>
                    <span className="font-extrabold text-white font-mono block">
                      R$ {inv.valorAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Bottom line: Yield % & Rescue Trigger */}
                <div className="z-10 flex justify-between items-center">
                  <div className="font-mono">
                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider block">Rentabilidade</span>
                    {hasYield ? (
                      <span className={`text-[11px] font-bold flex items-center gap-0.5 ${yieldColor}`}>
                        {pct >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {pct.toFixed(2)}% ({inv.rentabilidade ? `${inv.rentabilidade}% a.a.` : "S/Taxa"})
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-zinc-500">
                        {inv.rentabilidade ? `${inv.rentabilidade}% a.a.` : "Não informada"}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedHistInvestmentId(selectedHistInvestmentId === inv.id ? null : inv.id)}
                      className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-[10px] font-bold text-zinc-400 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                      title="Ver histórico de movimentações"
                    >
                      <History className="w-3.5 h-3.5" />
                      Extrato
                    </button>
                    {inv.ativo && inv.valorAtual > 0 && (
                      <button
                        type="button"
                        onClick={() => setRedeemingInvestment(inv)}
                        className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/30 text-[10px] font-extrabold text-amber-400 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowDownRight className="w-3.5 h-3.5 text-amber-400" />
                        Resgatar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* History view overlay below card grid */}
      {selectedHistInvestmentId && (
        <div className="p-5 rounded-2xl bg-zinc-900/10 border border-white/5 space-y-4 animate-fadeIn">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" />
              Histórico de Movimentações (Aportes/Resgates)
            </h4>
            <button
              type="button"
              onClick={() => setSelectedHistInvestmentId(null)}
              className="text-xs text-zinc-500 hover:text-white transition-colors cursor-pointer"
            >
              Fechar Extrato
            </button>
          </div>

          {loadingMovements ? (
            <div className="py-6 text-center text-zinc-500 text-xs flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 animate-spin text-emerald-400" />
              Carregando movimentações...
            </div>
          ) : movements.length === 0 ? (
            <div className="py-4 text-center text-zinc-500 text-xs italic">
              Nenhuma movimentação registrada para este investimento.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-zinc-900/30 border-b border-white/5">
                    <th className="py-2.5 px-3.5 font-mono text-zinc-500 text-[10px] font-bold uppercase">Data</th>
                    <th className="py-2.5 px-3.5 font-mono text-zinc-500 text-[10px] font-bold uppercase">Tipo</th>
                    <th className="py-2.5 px-3.5 font-mono text-zinc-500 text-[10px] font-bold uppercase text-right">Valor</th>
                    <th className="py-2.5 px-3.5 font-mono text-zinc-500 text-[10px] font-bold uppercase pl-8">Descrição / Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {movements.map((move) => {
                    const mDate = move.data?.toDate ? move.data.toDate() : new Date(move.data);
                    const isResgate = move.tipo === "resgate";

                    return (
                      <tr key={move.id} className="hover:bg-zinc-900/10">
                        <td className="py-2 px-3.5 text-zinc-400 font-mono">
                          {mDate.toLocaleDateString("pt-BR")}
                        </td>
                        <td className="py-2 px-3.5">
                          {isResgate ? (
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px] font-bold font-mono">
                              RESGATE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-bold font-mono">
                              APORTE
                            </span>
                          )}
                        </td>
                        <td className={`py-2 px-3.5 text-right font-bold font-mono ${isResgate ? "text-amber-400" : "text-emerald-400"}`}>
                          {isResgate ? "-" : "+"} R$ {move.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3.5 text-zinc-400 pl-8">
                          {move.descricao}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Redeem Modal trigger */}
      {redeemingInvestment && (
        <InvestmentRedeemModal
          investment={redeemingInvestment}
          banks={banks}
          userEmail={userEmail}
          onClose={() => setRedeemingInvestment(null)}
          onSuccess={() => {
            setRedeemingInvestment(null);
            // reset extrato to refresh
            if (selectedHistInvestmentId) {
              const prev = selectedHistInvestmentId;
              setSelectedHistInvestmentId(null);
              setTimeout(() => setSelectedHistInvestmentId(prev), 100);
            }
          }}
        />
      )}

      {/* Creation/Editing modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-950 border border-white/10 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl shadow-black">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PiggyBank className="w-5 h-5 text-emerald-400" />
                {editingInvestment ? "Editar Investimento" : "Novo Investimento"}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Nome do Ativo*</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Tesouro Selic 2029"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Instituição*</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: XP, Nubank, Nu Invest"
                    value={instituicao}
                    onChange={(e) => setInstituicao(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Tipo</label>
                  <select
                    value={tipoInvestimento}
                    onChange={(e) => setTipoInvestimento(e.target.value as Investment["tipoInvestimento"])}
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 font-bold"
                  >
                    <option value="renda_fixa">Renda Fixa (CDB/LCI/LCA)</option>
                    <option value="renda_variavel">Renda Variável (Fundos)</option>
                    <option value="tesouro">Tesouro Direto</option>
                    <option value="acoes">Ações</option>
                    <option value="fii">Fundos Imobiliários (FII)</option>
                    <option value="cripto">Criptoativos / BTC</option>
                    <option value="fundo">Fundos de Investimentos</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Rentabilidade (% a.a.)</label>
                  <input
                    type="text"
                    placeholder="Ex: 10.75"
                    value={rentabilidade}
                    onChange={(e) => setRentabilidade(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 font-mono font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Valor Inicial (R$)*</label>
                  <input
                    type="text"
                    required
                    placeholder="0,00"
                    disabled={!!editingInvestment}
                    value={valorInicial}
                    onChange={(e) => setValorInicial(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 disabled:opacity-50 font-bold font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Valor Atual (R$)*</label>
                  <input
                    type="text"
                    required
                    placeholder="0,00"
                    value={valorAtual}
                    onChange={(e) => setValorAtual(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 font-bold font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Data da Aplicação*</label>
                <input
                  type="date"
                  required
                  value={dataAplicacao}
                  onChange={(e) => setDataAplicacao(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Descrição (Opcional)</label>
                <textarea
                  placeholder="Detalhes da aplicação, vencimento, carência, etc."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 h-16 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="invAtivo"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="rounded bg-zinc-900 border-white/5 text-emerald-500 focus:ring-0"
                />
                <label htmlFor="invAtivo" className="text-xs font-bold text-zinc-300 cursor-pointer font-mono uppercase tracking-wider select-none">
                  Investimento Ativo (Ativo true)
                </label>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white font-bold text-xs transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all cursor-pointer shadow-lg shadow-emerald-950/20"
                >
                  {editingInvestment ? "Salvar Alterações" : "Adicionar Ativo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
