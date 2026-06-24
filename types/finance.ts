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
  origem?: "manual" | "despesa" | "cartao";
  despesaId?: string | null;
  despesaTipo?: "fixa" | "variavel" | null;
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
  transacaoGeradaId?: string | null;
  saidaGerada?: boolean;

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

  // Campos de despesa de cartão de crédito
  origem?: "manual" | "cartao";
  cartaoId?: string | null;
  faturaId?: string | null;
  itemCartaoId?: string | null;

  // Campos de despesa parcelada no cartão
  parcelado?: boolean;
  parcelaAtual?: number;
  totalParcelas?: number;
  valorParcela?: number;
  valorTotalParcelado?: number;
  grupoParcelamentoId?: string | null;
  parcelamentoAtivo?: boolean;
  parcelamentoQuitado?: boolean;
  quitadoEm?: any; // timestamp, string or null
}

export interface CreditCard {
  id: string;
  nome: string;
  banco: string;
  finalCartao: string;
  diaInicioCiclo: number;
  diaFimCiclo: number;
  diaVencimento: number;
  vencimentoMesSeguinte: boolean;
  limite?: number | null;
  ativo: boolean;
  criadoEm?: any;
  atualizadoEm?: any;
  criadoPorEmail?: string;
}

export interface CardInvoice {
  id: string;
  cartaoId: string;
  cartaoNome: string;
  banco: string;
  finalCartao: string;
  competencia: string; // "YYYY-MM"
  dataInicioCiclo: any;
  dataFimCiclo: any;
  dataVencimento: any;
  valorTotal: number;
  totalFixasCartao: number;
  totalVariaveisCartao: number;
  totalPagamentos: number;
  totalCreditosEstornos: number;
  status: "aberta" | "fechada" | "vencida" | "paga";
  pagoEm?: any | null;
  transacaoGeradaId?: string | null;
  criadoEm?: any;
  atualizadoEm?: any;
  criadoPorEmail?: string;
}

export interface CardItem {
  id: string;
  cartaoId: string;
  cartaoNome: string;
  banco: string;
  finalCartao: string;
  faturaId?: string | null;
  dataCompra: any;
  descricao: string;
  categoria: string;
  valor: number;
  valorOriginal?: string;
  parcelaAtual?: number | null;
  totalParcelas?: number | null;
  parcelado: boolean;
  classificacaoCartao: "fixa_cartao" | "variavel_cartao" | "pagamento_fatura" | "credito_estorno" | "ignorar";
  status: "pendente" | "pago" | "ignorado";
  competencia: string;
  dataInicioCiclo: any;
  dataFimCiclo: any;
  dataVencimentoFatura: any;
  importHash: string;
  origem: "manual" | "importacao_csv" | "importacao_pdf" | "importacao_xlsx" | "importacao_ofx";
  criadoEm?: any;
  atualizadoEm?: any;
  criadoPorEmail?: string;
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

export interface ParsedCardItem {
  id: string;
  dataCompra: Date;
  descricao: string;
  nome: string;
  valor: number;
  valorOriginal: string;
  parcelaAtual: number | null;
  totalParcelas: number | null;
  parcelado: boolean;
  adicional?: string | null;
  portadorNome?: string | null;
  categoriaSugerida: string;
  destino: "despesa_fixa" | "despesa_variavel" | "ignorar" | "credito_estorno" | "pagamento_fatura";
  status: "pendente";
  raw: Record<string, unknown>;
  alreadyImported?: boolean;
}

export interface ImportInvoiceResult {
  metadata: {
    associado?: string;
    cooperativa?: string;
    contaCorrente?: string;
    cartaoNome?: string;
    finalCartao?: string;
    dataVencimento?: Date;
    valorTotal?: number;
    situacao?: string;
    bancoDetectado?: string;
    formatoDetectado?: "sicredi_csv" | "csv_generico" | "pdf" | "xlsx" | "ofx";
  };
  items: ParsedCardItem[];
}

export interface BankAccount {
  id: string;
  nome: string;
  tipoConta: "corrente" | "poupanca" | "caixa" | "carteira" | "outro";
  banco: string;
  saldoAtual: number;
  descricao?: string;
  ativo: boolean;
  criadoEm?: any;
  atualizadoEm?: any;
  criadoPorEmail?: string;
}

export interface Investment {
  id: string;
  nome: string;
  tipoInvestimento: "renda_fixa" | "renda_variavel" | "tesouro" | "acoes" | "fii" | "cripto" | "fundo" | "outro";
  instituicao: string;
  valorAtual: number;
  valorInicial: number;
  dataAplicacao: any;
  rentabilidade?: number | null;
  descricao?: string;
  ativo: boolean;
  criadoEm?: any;
  atualizadoEm?: any;
  criadoPorEmail?: string;
}

export interface Asset {
  id: string;
  nome: string;
  tipoPatrimonio: "casa" | "apartamento" | "carro" | "moto" | "terreno" | "empresa" | "equipamento" | "outro";
  valorEstimado: number;
  dataAquisicao?: any | null;
  descricao?: string;
  ativo: boolean;
  criadoEm?: any;
  atualizadoEm?: any;
  criadoPorEmail?: string;
}

export interface InvestmentMovement {
  id: string;
  investimentoId: string;
  tipo: "aporte" | "resgate";
  valor: number;
  data: any;
  bancoDestinoId?: string | null;
  descricao?: string;
  criadoEm?: any;
  criadoPorEmail?: string;
}

