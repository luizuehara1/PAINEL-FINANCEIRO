import React, { useState } from "react";
import { CreditCard } from "@/types/finance";
import { db } from "@/lib/firebase";
import { COMPANY_ID } from "@/lib/app-config";
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from "firebase/firestore";
import { X, Check } from "lucide-react";
import { calculateCardCycle } from "@/lib/card-cycle-utils";

interface CardManualEntryFormProps {
  card: CreditCard;
  userEmail: string;
  onClose: () => void;
  onSave: (newCompetencia?: string) => void;
  categories: string[];
}

export function CardManualEntryForm({ card, userEmail, onClose, onSave, categories }: CardManualEntryFormProps) {
  const [dataCompra, setDataCompra] = useState(new Date().toISOString().split("T")[0]);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState(categories[0] || "Outros");
  const [classificacao, setClassificacao] = useState<"fixa_cartao" | "variavel_cartao">("variavel_cartao");
  const [isParcelado, setIsParcelado] = useState(false);
  const [totalParcelas, setTotalParcelas] = useState<number>(2);
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim() || !valor.trim() || !dataCompra) {
      setError("Por favor, preencha a data, descrição e valor.");
      return;
    }

    const rawValor = parseFloat(valor.replace(",", "."));
    if (isNaN(rawValor) || rawValor <= 0) {
      setError("Por favor, digite um valor válido maior que zero.");
      return;
    }

    setLoading(true);
    setError(null);

    let savedCompetencia: string | undefined = undefined;

    try {
      if (isParcelado && totalParcelas > 1) {
        // Installment purchase: e.g. 300,00 split into 3 installments of 100,00
        const valorParcela = Number((rawValor / totalParcelas).toFixed(2));
        const originalDate = new Date(dataCompra + "T12:00:00");

        for (let i = 1; i <= totalParcelas; i++) {
          // Increment month for each installment purchase date
          const instDate = new Date(originalDate);
          instDate.setMonth(originalDate.getMonth() + (i - 1));

          const cycleData = calculateCardCycle(instDate, card);
          if (i === 1) {
            savedCompetencia = cycleData.competencia;
          }

          const payload = {
            companyId: COMPANY_ID,
            cartaoId: card.id,
            cartaoNome: card.nome,
            banco: card.banco,
            finalCartao: card.finalCartao,
            faturaId: null, // Will be linked automatically or resolved in detail view
            dataCompra: instDate,
            descricao: `${descricao.trim()} (${i}/${totalParcelas})`,
            categoria,
            valor: valorParcela,
            valorOriginal: rawValor,
            parcelaAtual: i,
            totalParcelas,
            parcelado: true,
            classificacaoCartao: classificacao,
            status: "pendente",
            competencia: cycleData.competencia,
            dataInicioCiclo: cycleData.dataInicioCiclo,
            dataFimCiclo: cycleData.dataFimCiclo,
            dataVencimentoFatura: cycleData.dataVencimentoFatura,
            importHash: `manual_${card.id}_${Date.now()}_${i}`,
            origem: "manual",
            criadoEm: serverTimestamp(),
            atualizadoEm: serverTimestamp(),
            criadoPorEmail: userEmail,
            observacao: observacao.trim() || null
          };

          await addDoc(collection(db, "financeiro", "geral", "itensCartao"), payload);
        }
      } else {
        // Single purchase
        const cycleData = calculateCardCycle(new Date(dataCompra + "T12:00:00"), card);
        savedCompetencia = cycleData.competencia;

        const payload = {
          companyId: COMPANY_ID,
          cartaoId: card.id,
          cartaoNome: card.nome,
          banco: card.banco,
          finalCartao: card.finalCartao,
          faturaId: null,
          dataCompra: new Date(dataCompra + "T12:00:00"),
          descricao: descricao.trim(),
          categoria,
          valor: rawValor,
          valorOriginal: rawValor,
          parcelaAtual: null,
          totalParcelas: null,
          parcelado: false,
          classificacaoCartao: classificacao,
          status: "pendente",
          competencia: cycleData.competencia,
          dataInicioCiclo: cycleData.dataInicioCiclo,
          dataFimCiclo: cycleData.dataFimCiclo,
          dataVencimentoFatura: cycleData.dataVencimentoFatura,
          importHash: `manual_${card.id}_${Date.now()}`,
          origem: "manual",
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
          criadoPorEmail: userEmail,
          observacao: observacao.trim() || null
        };

        await addDoc(collection(db, "financeiro", "geral", "itensCartao"), payload);
      }

      onSave(savedCompetencia);
    } catch (err: any) {
      console.error("Erro ao salvar lançamento manual no cartão:", err);
      setError("Erro ao salvar compra no cartão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal Card */}
      <div 
        id="card-manual-entry-form"
        className="relative w-full max-w-lg overflow-hidden rounded-3xl p-[1px] bg-gradient-to-tr from-emerald-500/30 via-zinc-800 to-zinc-800 shadow-2xl z-10"
      >
        <div className="bg-zinc-950 rounded-[23px] px-6 py-7 border border-white/5">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                Nova Compra no Cartão
              </h3>
              <p className="text-[10px] text-emerald-400 font-mono mt-0.5 uppercase">
                {card.nome} • Final {card.finalCartao}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white transition-all hover:scale-105 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                  Data da Compra
                </label>
                <input
                  type="date"
                  value={dataCompra}
                  onChange={(e) => setDataCompra(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                  Valor Total (R$)
                </label>
                <input
                  type="text"
                  placeholder="0,00"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                Descrição / Estabelecimento
              </label>
              <input
                type="text"
                placeholder="Ex: Supermercado Assaí"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                  Categoria
                </label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                  Classificação Interna
                </label>
                <select
                  value={classificacao}
                  onChange={(e) => setClassificacao(e.target.value as any)}
                  className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="variavel_cartao">Variável do Cartão</option>
                  <option value="fixa_cartao">Fixa do Cartão</option>
                </select>
              </div>
            </div>

            {/* Installment section toggle */}
            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-zinc-200">Compra Parcelada?</span>
                  <span className="block text-[10px] text-zinc-500">
                    Dividir valor total em parcelas mensais iguais.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isParcelado}
                    onChange={(e) => setIsParcelado(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-white" />
                </label>
              </div>

              {isParcelado && (
                <div className="pt-2">
                  <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                    Número de Parcelas
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={72}
                    value={totalParcelas}
                    onChange={(e) => setTotalParcelas(Math.max(2, Number(e.target.value)))}
                    className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                    required
                  />
                  {valor && !isNaN(parseFloat(valor)) && (
                    <span className="text-[10px] text-emerald-400 mt-1.5 block font-mono">
                      Parcelas: {totalParcelas}x de R${" "}
                      {(parseFloat(valor.replace(",", ".")) / totalParcelas).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
                Observações / Detalhes (Opcional)
              </label>
              <textarea
                placeholder="Insira detalhes adicionais sobre a compra..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 h-20 resize-none"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2.5 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 font-semibold text-xs text-zinc-400 hover:text-white transition-all cursor-pointer border border-white/5"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/40 active:scale-95 disabled:opacity-55"
              >
                <Check className="w-4 h-4" />
                {loading ? "Processando..." : "Confirmar Lançamento"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
