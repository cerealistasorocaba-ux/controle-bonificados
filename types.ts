
export interface BonusProduct {
  id: string;
  codigo: string;
  descricao: string;
  valorBonificacao: number;
  ativo: boolean;
}

export interface ProductQuantity {
  descricao: string;
  quantidade: number;
}

export interface SellerBonusSummary {
  vendedor: string;
  qtdePorBonus: Record<number, number>; // value -> quantity
  vendasPorProduto: ProductQuantity[]; // description -> quantity
  totalBonificacao: number;
}

export interface ProcessingHistoryItem {
  id: string;
  dataProcessamento: string;
  arquivoOrigem: string;
  totalVendedores: number;
  totalBonificacao: number;
  detalhes: SellerBonusSummary[];
}

export enum AppTab {
  Dashboard = 'dashboard',
  Configuracao = 'configuracao',
  Processamento = 'processamento',
  Historico = 'historico'
}
