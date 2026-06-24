export interface Transaction {
  id: string;
  tipo: "entrada" | "saida";
  nome: string;
  descricao: string;
  categoria: string;
  valor: number;
  formaPagamento: string;
  data: string; // "YYYY-MM-DD" or similar ISO date string
  criadoEm: string;
  criadoPorEmail?: string;
  notaUrl?: string | null;
  notaPublicId?: string | null;
  notaTipo?: string | null;
  notaNome?: string | null;
}

export interface Expense {
  id: string;
  tipo: "fixa" | "variavel";
  nome: string;
  descricao: string;
  categoria: string;
  valor: number;
  formaPagamento: string;
  data: string; // for variable expenses, "YYYY-MM-DD"
  dataVencimento: string; // for fixed expenses, "YYYY-MM-DD"
  status: "pendente" | "pago";
  pagoEm?: string;
  criadoEm: string;
  criadoPorEmail?: string;

  // Campos de recorrência inteligente
  diaVencimento?: number;
  competencia?: string; // "YYYY-MM"
  recorrente?: boolean;
  recorrenciaAtiva?: boolean;
  despesaOrigemId?: string | null;
  grupoRecorrenciaId?: string;
  baixadaCompletamente?: boolean;
  baixadaEm?: string | null;
  motivoBaixa?: string | null;

  notaUrl?: string | null;
  notaPublicId?: string | null;
  notaTipo?: string | null;
  notaNome?: string | null;
}

export interface FinanceAttachment {
  url: string;
  publicId: string;
  tipo: string;
  nome: string;
}

export interface FinanceCategory {
  id: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  criadoEm?: any;
  atualizadoEm?: any;
  criadoPorEmail?: string;
}

export interface PaymentMethod {
  id: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  criadoEm?: any;
  atualizadoEm?: any;
  criadoPorEmail?: string;
}
