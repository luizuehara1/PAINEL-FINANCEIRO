"use client";

import React, { useState } from "react";
import { Asset } from "@/types/finance";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Home, 
  Car, 
  Key, 
  Briefcase, 
  Wrench, 
  Coins, 
  Calendar, 
  Power 
} from "lucide-react";

interface AssetsManagerProps {
  assets: Asset[];
  userEmail: string;
}

export function AssetsManager({ assets, userEmail }: AssetsManagerProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  // Form states
  const [nome, setNome] = useState("");
  const [tipoPatrimonio, setTipoPatrimonio] = useState<Asset["tipoPatrimonio"]>("casa");
  const [valorEstimado, setValorEstimado] = useState("");
  const [dataAquisicao, setDataAquisicao] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ativo, setAtivo] = useState(true);

  const handleOpenCreate = () => {
    setEditingAsset(null);
    setNome("");
    setTipoPatrimonio("casa");
    setValorEstimado("");
    setDataAquisicao("");
    setDescricao("");
    setAtivo(true);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (ast: Asset) => {
    setEditingAsset(ast);
    setNome(ast.nome);
    setTipoPatrimonio(ast.tipoPatrimonio);
    setValorEstimado(String(ast.valorEstimado));
    
    let dateStr = "";
    if (ast.dataAquisicao) {
      const d = ast.dataAquisicao.toDate ? ast.dataAquisicao.toDate() : new Date(ast.dataAquisicao);
      if (!isNaN(d.getTime())) {
        dateStr = d.toISOString().split("T")[0];
      }
    }
    setDataAquisicao(dateStr);
    setDescricao(ast.descricao || "");
    setAtivo(ast.ativo);
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !valorEstimado) {
      alert("Por favor, preencha os campos obrigatórios.");
      return;
    }

    const valEst = parseFloat(valorEstimado.replace(",", "."));
    if (isNaN(valEst) || valEst < 0) {
      alert("Por favor, informe um valor estimado válido.");
      return;
    }

    // Convert date string safely to Timestamp or null
    let acqDate = null;
    if (dataAquisicao) {
      const [y, m, d] = dataAquisicao.split("-").map(Number);
      acqDate = Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));
    }

    const path = "financeiro/geral/patrimonios";
    try {
      if (editingAsset) {
        const assetRef = doc(db, path, editingAsset.id);
        await updateDoc(assetRef, {
          nome,
          tipoPatrimonio,
          valorEstimado: valEst,
          dataAquisicao: acqDate,
          descricao,
          ativo,
          atualizadoEm: Timestamp.now()
        });
      } else {
        await addDoc(collection(db, path), {
          nome,
          tipoPatrimonio,
          valorEstimado: valEst,
          dataAquisicao: acqDate,
          descricao,
          ativo,
          criadoEm: Timestamp.now(),
          atualizadoEm: Timestamp.now(),
          criadoPorEmail: userEmail
        });
      }
      setIsFormOpen(false);
      setEditingAsset(null);
    } catch (error) {
      handleFirestoreError(error, editingAsset ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const handleDelete = async (ast: Asset) => {
    if (!confirm(`Tem certeza que deseja excluir o patrimônio "${ast.nome}"?`)) {
      return;
    }
    const path = "financeiro/geral/patrimonios";
    try {
      await deleteDoc(doc(db, path, ast.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleToggleAtivo = async (ast: Asset) => {
    const path = "financeiro/geral/patrimonios";
    try {
      await updateDoc(doc(db, path, ast.id), {
        ativo: !ast.ativo,
        atualizadoEm: Timestamp.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const getAssetTypeIcon = (type: Asset["tipoPatrimonio"]) => {
    switch (type) {
      case "casa":
      case "apartamento":
        return <Home className="w-4 h-4 text-emerald-400" />;
      case "carro":
      case "moto":
        return <Car className="w-4 h-4 text-blue-400" />;
      case "terreno":
        return <Key className="w-4 h-4 text-amber-400" />;
      case "empresa":
        return <Briefcase className="w-4 h-4 text-purple-400" />;
      case "equipamento":
        return <Wrench className="w-4 h-4 text-zinc-400" />;
      default:
        return <Coins className="w-4 h-4 text-teal-400" />;
    }
  };

  const getAssetTypeLabel = (type: Asset["tipoPatrimonio"]) => {
    switch (type) {
      case "casa": return "Casa / Residência";
      case "apartamento": return "Apartamento";
      case "carro": return "Carro / Veículo";
      case "moto": return "Moto";
      case "terreno": return "Terreno / Lote";
      case "empresa": return "Participação em Empresa";
      case "equipamento": return "Equipamento / Maquinário";
      default: return "Outro bem";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
          <Home className="w-4 h-4 text-emerald-400" />
          Patrimônios e Bens ({assets.length})
        </h3>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Novo Patrimônio
        </button>
      </div>

      {/* Grid listing */}
      {assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/10 space-y-3">
          <Home className="w-8 h-8 text-zinc-600" />
          <p className="text-xs text-zinc-500 font-medium">Nenhum patrimônio ou bem cadastrado ainda.</p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-bold transition-all underline cursor-pointer"
          >
            Cadastrar primeiro imóvel, veículo ou bem patrimonial
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {assets.map((ast) => {
            const acqDateStr = ast.dataAquisicao?.toDate 
              ? ast.dataAquisicao.toDate().toLocaleDateString("pt-BR") 
              : ast.dataAquisicao 
              ? new Date(ast.dataAquisicao).toLocaleDateString("pt-BR") 
              : "Não informada";

            return (
              <div
                key={ast.id}
                className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between h-48 relative overflow-hidden group ${
                  ast.ativo 
                    ? "border-white/5 bg-zinc-900/10 hover:border-emerald-500/20 hover:bg-zinc-900/20" 
                    : "border-white/5 bg-zinc-900/50 opacity-60"
                }`}
              >
                {/* Visual decor */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-all" />

                {/* Top line: Name & Actions */}
                <div className="flex justify-between items-start z-10">
                  <div>
                    <div className="flex items-center gap-1.5">
                      {getAssetTypeIcon(ast.tipoPatrimonio)}
                      <span className="text-[10px] font-bold text-zinc-400 font-mono uppercase">
                        {getAssetTypeLabel(ast.tipoPatrimonio)}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white mt-1 group-hover:text-emerald-300 transition-colors">
                      {ast.nome}
                    </h4>
                  </div>

                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleAtivo(ast)}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        ast.ativo 
                          ? "bg-zinc-950 border-white/5 text-emerald-400 hover:bg-zinc-900" 
                          : "bg-zinc-950 border-white/5 text-zinc-500 hover:bg-zinc-900"
                      }`}
                      title={ast.ativo ? "Desativar bem" : "Ativar bem"}
                    >
                      <Power className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(ast)}
                      className="p-1.5 rounded-lg bg-zinc-950 border border-white/5 text-zinc-400 hover:text-white transition-all cursor-pointer"
                      title="Editar"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(ast)}
                      className="p-1.5 rounded-lg bg-zinc-950 border border-white/5 text-zinc-400 hover:text-red-400 transition-all cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Description if any */}
                <div className="z-10 text-[11px] text-zinc-400 line-clamp-2 mt-1 select-none pr-4">
                  {ast.descricao || <span className="text-zinc-600 italic">Sem descrição adicional</span>}
                </div>

                {/* Bottom line: Estimated value & Acquisition Date */}
                <div className="border-t border-white/5 pt-3 mt-2 z-10 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono block">Valor Estimado</span>
                    <span className="text-sm font-extrabold font-mono text-emerald-400">
                      R$ {ast.valorEstimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono block font-mono">Aquisição</span>
                    <span className="text-[10px] font-semibold text-zinc-300 mt-0.5 block">
                      {acqDateStr}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Creation/Editing Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-950 border border-white/10 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl shadow-black">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Home className="w-5 h-5 text-emerald-400" />
                {editingAsset ? "Editar Patrimônio / Bem" : "Novo Patrimônio / Bem"}
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
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Nome do Bem*</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carro Compass 2024"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Tipo de Bem</label>
                  <select
                    value={tipoPatrimonio}
                    onChange={(e) => setTipoPatrimonio(e.target.value as Asset["tipoPatrimonio"])}
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 font-bold"
                  >
                    <option value="casa">Casa / Residência</option>
                    <option value="apartamento">Apartamento</option>
                    <option value="carro">Carro</option>
                    <option value="moto">Moto</option>
                    <option value="terreno">Terreno</option>
                    <option value="empresa">Empresa / Quota-Parte</option>
                    <option value="equipamento">Equipamento / Máquina</option>
                    <option value="outro">Outro bem</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Valor Estimado (R$)*</label>
                  <input
                    type="text"
                    required
                    placeholder="0,00"
                    value={valorEstimado}
                    onChange={(e) => setValorEstimado(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 font-bold font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Data de Aquisição</label>
                  <input
                    type="date"
                    value={dataAquisicao}
                    onChange={(e) => setDataAquisicao(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Descrição (Opcional)</label>
                <textarea
                  placeholder="Observações adicionais (Placa, Matrícula de Cartório, Número de Série, etc.)"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 h-20 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="assetAtivo"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="rounded bg-zinc-900 border-white/5 text-emerald-500 focus:ring-0"
                />
                <label htmlFor="assetAtivo" className="text-xs font-bold text-zinc-300 cursor-pointer font-mono uppercase tracking-wider select-none">
                  Bem Patrimonial Ativo (Ativo true)
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
                  {editingAsset ? "Salvar Alterações" : "Cadastrar Bem"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
