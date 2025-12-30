
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
  codigoVendedor: string;
  vendedor: string; // Nome do vendedor
  qtdePorBonus: Record<number, number>; // valor -> quantidade
  vendasPorProduto: ProductQuantity[]; // descrição -> quantidade
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
