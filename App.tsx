
import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Search, 
  FileUp, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  TrendingUp,
  Users,
  DollarSign,
  FileSearch,
  History,
  LayoutGrid,
  ClipboardList,
  Key,
  ExternalLink,
  LineChart,
  Save,
  Check
} from 'lucide-react';
import { 
  BonusProduct, 
  AppTab, 
  ProcessingHistoryItem, 
  SellerBonusSummary 
} from './types';
import { INITIAL_PRODUCTS, TABS } from './constants';
import { processSalesReport } from './services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const LogoERP = () => (
  <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200">
    <LineChart className="text-white" size={24} />
  </div>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.Dashboard);
  const [products, setProducts] = useState<BonusProduct[]>([]);
  const [history, setHistory] = useState<ProcessingHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [viewMode, setViewMode] = useState<Record<string, 'summary' | 'products'>>({});
  const [hasStudioKey, setHasStudioKey] = useState<boolean>(false);
  const [manualApiKey, setManualApiKey] = useState<string>('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const savedProducts = localStorage.getItem('bonus_products');
    const savedHistory = localStorage.getItem('bonus_history');
    const savedKey = localStorage.getItem('manual_api_key');
    
    if (savedProducts) setProducts(JSON.parse(savedProducts));
    else setProducts(INITIAL_PRODUCTS);
    
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedKey) setManualApiKey(savedKey);
    
    checkStudioKey();
  }, []);

  const checkStudioKey = async () => {
    if (window.aistudio) {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasStudioKey(selected);
    }
  };

  const handleOpenStudioKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasStudioKey(true);
    }
  };

  const handleManualKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualApiKey(e.target.value);
    setSaveSuccess(false);
  };

  const handleSaveManualKey = () => {
    if (!manualApiKey.trim()) {
      alert("Por favor, insira uma chave de API válida.");
      return;
    }
    
    setIsSavingKey(true);
    setTimeout(() => {
      localStorage.setItem('manual_api_key', manualApiKey);
      setIsSavingKey(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 800);
  };

  useEffect(() => {
    localStorage.setItem('bonus_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('bonus_history', JSON.stringify(history));
  }, [history]);

  const addProduct = () => {
    const newProduct: BonusProduct = {
      id: Date.now().toString(),
      codigo: '',
      descricao: '',
      valorBonificacao: 5.0,
      ativo: true
    };
    setProducts([...products, newProduct]);
  };

  const updateProduct = (id: string, updates: Partial<BonusProduct>) => {
    setProducts(products.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const removeProduct = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setSelectedFiles(Array.from(e.target.files));
  };

  const processReports = async () => {
    if (selectedFiles.length === 0) return;
    
    const effectiveKey = hasStudioKey ? undefined : manualApiKey;
    
    if (!hasStudioKey && !manualApiKey) {
      alert("Nenhuma chave de API detectada. Por favor, conecte-se via Google ou salve sua chave manualmente no Painel.");
      return;
    }

    setIsLoading(true);
    setProcessingStatus('Iniciando extração inteligente...');
    
    try {
      const activeProds = products.filter(p => p.ativo);
      const consolidatedSellers: Record<string, SellerBonusSummary> = {};

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setProcessingStatus(`Lendo arquivo ${i + 1}/${selectedFiles.length}: ${file.name}`);
        const results = await processSalesReport(file, activeProds, effectiveKey);
        
        results.forEach(newSeller => {
          // INDEXADOR ÚNICO: Código do Vendedor
          const sellerCode = newSeller.codigoVendedor;
          
          if (!consolidatedSellers[sellerCode]) {
            consolidatedSellers[sellerCode] = {
              codigoVendedor: sellerCode,
              vendedor: newSeller.vendedor,
              qtdePorBonus: {},
              vendasPorProduto: [],
              totalBonificacao: 0
            };
          }
          
          consolidatedSellers[sellerCode].totalBonificacao += newSeller.totalBonificacao;
          
          Object.entries(newSeller.qtdePorBonus).forEach(([bonusValStr, qty]) => {
            const normalizedKey = parseFloat(bonusValStr).toFixed(2);
            consolidatedSellers[sellerCode].qtdePorBonus[normalizedKey as any] = 
              (consolidatedSellers[sellerCode].qtdePorBonus[normalizedKey as any] || 0) + (qty as number);
          });

          newSeller.vendasPorProduto.forEach(p => {
            const existingProd = consolidatedSellers[sellerCode].vendasPorProduto.find(ep => ep.descricao === p.descricao);
            if (existingProd) {
              existingProd.quantidade += p.quantidade;
            } else {
              consolidatedSellers[sellerCode].vendasPorProduto.push({ ...p });
            }
          });
        });
      }

      const allResults = Object.values(consolidatedSellers).sort((a, b) => Number(a.codigoVendedor) - Number(b.codigoVendedor));
      const totalBonificacao = allResults.reduce((acc, curr) => acc + curr.totalBonificacao, 0);
      
      const newHistoryItem: ProcessingHistoryItem = {
        id: Date.now().toString(),
        dataProcessamento: new Date().toISOString(),
        arquivoOrigem: selectedFiles.map(f => f.name).join(', '),
        totalVendedores: allResults.length,
        totalBonificacao,
        detalhes: allResults
      };

      setHistory([newHistoryItem, ...history]);
      setSelectedFiles([]);
      setActiveTab(AppTab.Dashboard);
    } catch (error: any) {
      console.error(error);
      alert('Erro ao processar relatórios. Verifique a chave de API ou a qualidade do documento.');
    } finally {
      setIsLoading(false);
      setProcessingStatus('');
    }
  };

  const totalPagamentos = history.reduce((acc, curr) => acc + curr.totalBonificacao, 0);
  const totalProcessamentos = history.length;
  const totalSellersUnique = new Set(history.flatMap(h => h.detalhes.map(d => d.codigoVendedor))).size;

  const chartData = history.slice(0, 10).reverse().map(h => ({
    data: new Date(h.dataProcessamento).toLocaleDateString('pt-BR'),
    total: h.totalBonificacao
  }));

  const isApiReady = hasStudioKey || (manualApiKey && manualApiKey.length > 20);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc]">
      <aside className="w-full md:w-72 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-auto md:h-screen">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <LogoERP />
            <div>
              <h1 className="font-bold text-xl text-slate-800 leading-tight">ERP Bonus</h1>
              <p className="text-sm font-medium text-slate-400">Sistema de Controle</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AppTab)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === tab.id ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">
            <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Status do Sistema</p>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isApiReady ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <p className="text-sm font-medium text-slate-600 truncate">
                {hasStudioKey ? 'IA Conectada' : manualApiKey ? 'IA Manual Ativa' : 'IA Offline'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-slate-200 px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{TABS.find(t => t.id === activeTab)?.label}</h2>
            <p className="text-sm text-slate-500 mt-1">Gerencie as bonificações da Cerealista Sorocaba.</p>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === AppTab.Configuracao && (
              <button onClick={addProduct} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg shadow-indigo-100">
                <Plus size={18} /> Novo Produto
              </button>
            )}
            {activeTab === AppTab.Processamento && (
              <button onClick={processReports} disabled={isLoading || selectedFiles.length === 0} className={`px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg ${isLoading || selectedFiles.length === 0 ? 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100'}`}>
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : <FileUp size={18} />}
                {isLoading ? 'Extraindo...' : 'Processar Relatórios'}
              </button>
            )}
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {activeTab === AppTab.Dashboard && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5">
                  <div className="bg-indigo-50 text-indigo-600 p-4 rounded-xl"><DollarSign size={28} /></div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Bonificação Acumulada</p>
                    <p className="text-2xl font-bold text-slate-900">R$ {totalPagamentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5">
                  <div className="bg-indigo-50 text-indigo-600 p-4 rounded-xl"><Users size={28} /></div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Vendedores Ativos</p>
                    <p className="text-2xl font-bold text-slate-900">{totalSellersUnique}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5">
                  <div className="bg-indigo-50 text-indigo-600 p-4 rounded-xl"><FileSearch size={28} /></div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Relatórios Analisados</p>
                    <p className="text-2xl font-bold text-slate-900">{totalProcessamentos}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <Key className="text-indigo-600" size={24} />
                      <h3 className="font-bold text-slate-800">Conectar Inteligência Artificial</h3>
                   </div>
                   {!isApiReady && <span className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-full font-bold">REQUER CHAVE</span>}
                </div>
                <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                   <div className="space-y-4">
                      <label className="block text-sm font-bold text-slate-700">Opção 1: Conectar via Google</label>
                      <button onClick={handleOpenStudioKey} className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${hasStudioKey ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'}`}>
                         {hasStudioKey ? <CheckCircle2 size={18} /> : <Key size={18} />}
                         {hasStudioKey ? 'Conectado via Studio' : 'Vincular API Key do Google'}
                      </button>
                   </div>
                   <div className="space-y-4 lg:border-l border-slate-100 lg:pl-8">
                      <label className="block text-sm font-bold text-slate-700">Opção 2: Colar Manualmente</label>
                      <div className="flex gap-2">
                        <input 
                          type="password" 
                          value={manualApiKey} 
                          onChange={handleManualKeyChange}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                          placeholder="Cole sua chave aqui..."
                        />
                        <button 
                          onClick={handleSaveManualKey}
                          disabled={isSavingKey}
                          className={`px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all min-w-[120px] ${
                            saveSuccess ? 'bg-green-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'
                          }`}
                        >
                          {isSavingKey ? <Loader2 className="animate-spin" size={18} /> : saveSuccess ? <Check size={18} /> : <Save size={18} />}
                          {saveSuccess ? 'Salvo!' : 'Salvar'}
                        </button>
                      </div>
                      <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-[10px] text-indigo-600 font-bold hover:underline flex items-center gap-1">
                         Criar nova chave (Google AI Studio) <ExternalLink size={10} />
                      </a>
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === AppTab.Historico && (
            <div className="space-y-6">
              {history.length > 0 ? history.map((item) => {
                const isProductsView = viewMode[item.id] === 'products';
                const allProductDescriptions = Array.from(new Set(item.detalhes.flatMap(d => d.vendasPorProduto.map(v => v.descricao)))).sort();

                return (
                  <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="bg-white p-3 rounded-xl border border-slate-200 text-indigo-600 shadow-sm"><CheckCircle2 size={24} /></div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Processamento Finalizado</p>
                          <h4 className="font-bold text-slate-800">{new Date(item.dataProcessamento).toLocaleString('pt-BR')}</h4>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex bg-white border border-slate-200 rounded-xl p-1">
                          <button onClick={() => setViewMode({...viewMode, [item.id]: 'summary'})} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!isProductsView ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}>Resumo</button>
                          <button onClick={() => setViewMode({...viewMode, [item.id]: 'products'})} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isProductsView ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}>Detalhado</button>
                        </div>
                        <div className="text-right px-4">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Total Bônus</p>
                          <p className="font-bold text-indigo-600">R$ {item.totalBonificacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <button onClick={() => {
                          const csvContent = "data:text/csv;charset=utf-8,Codigo,Vendedor,Bonificacao Total\n" + item.detalhes.map(d => `${d.codigoVendedor},${d.vendedor},${d.totalBonificacao.toFixed(2)}`).join("\n");
                          const link = document.createElement("a");
                          link.setAttribute("href", encodeURI(csvContent));
                          link.setAttribute("download", `extracao_${item.id}.csv`);
                          document.body.appendChild(link);
                          link.click();
                        }} className="bg-white border border-slate-200 p-2.5 rounded-xl hover:bg-slate-50 text-slate-500"><Download size={20} /></button>
                      </div>
                    </div>

                    <div className="p-0 overflow-x-auto">
                      {!isProductsView ? (
                        <table className="w-full text-left min-w-[600px]">
                          <thead className="bg-slate-50/50">
                            <tr>
                              <th className="px-8 py-3 text-[10px] font-bold text-slate-400 uppercase">Vendedor</th>
                              <th className="px-8 py-3 text-[10px] font-bold text-slate-400 uppercase">Bonificações</th>
                              <th className="px-8 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">Valor Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {item.detalhes.map((det: SellerBonusSummary, idx: number) => (
                              <tr key={idx} className="hover:bg-indigo-50/20">
                                <td className="px-8 py-4">
                                  <span className="font-semibold text-slate-700 text-sm">{det.codigoVendedor} - {det.vendedor}</span>
                                </td>
                                <td className="px-8 py-4">
                                  <div className="flex gap-2 flex-wrap">
                                    {Object.entries(det.qtdePorBonus).map(([val, qty]) => (
                                      <span key={val} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 shadow-sm">
                                        <span className="font-bold text-indigo-700">{qty}x</span> R$ {parseFloat(val).toFixed(2)}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-8 py-4 text-right">
                                  <span className="font-bold text-slate-900 text-sm">R$ {det.totalBonificacao.toFixed(2)}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <table className="w-full text-left border-collapse min-w-[800px]">
                          <thead className="bg-slate-100">
                            <tr>
                              <th className="px-4 py-3 border border-slate-200 text-[10px] font-bold text-slate-500 uppercase">Cód - Vendedor</th>
                              {allProductDescriptions.map((desc, i) => (
                                <th key={i} className="px-4 py-3 border border-slate-200 text-[9px] font-bold text-slate-500 uppercase text-center max-w-[100px] truncate" title={desc}>
                                  {String(desc).split(' ').slice(0, 2).join(' ')}
                                </th>
                              ))}
                              <th className="px-4 py-3 border border-slate-200 text-[10px] font-bold text-slate-500 uppercase text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.detalhes.map((det: SellerBonusSummary, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="px-4 py-3 border border-slate-200 text-xs font-semibold text-slate-700 whitespace-nowrap">{det.codigoVendedor} - {det.vendedor}</td>
                                {allProductDescriptions.map((desc, i) => {
                                  const qty = det.vendasPorProduto.find(v => v.descricao === desc)?.quantidade || 0;
                                  return (
                                    <td key={i} className={`px-4 py-3 border border-slate-200 text-center text-sm font-medium ${qty > 0 ? 'text-indigo-600 bg-indigo-50/30' : 'text-slate-300'}`}>
                                      {qty}
                                    </td>
                                  );
                                })}
                                <td className="px-4 py-3 border border-slate-200 text-right font-bold text-slate-900 text-xs whitespace-nowrap">
                                  R$ {det.totalBonificacao.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                );
              }) : <div className="bg-white p-20 rounded-3xl shadow-sm border border-slate-100 text-center"><History size={32} className="text-slate-300 mx-auto mb-4" /><p className="text-slate-500">O histórico de extrações aparecerá aqui.</p></div>}
            </div>
          )}

          {activeTab === AppTab.Configuracao && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Produtos e Valores de Bônus</p>
                <span className="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-bold">{products.length} itens</span>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Código</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Descrição</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Bônus (R$)</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-center">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4"><input type="text" value={p.codigo} onChange={(e) => updateProduct(p.id, { codigo: e.target.value })} className="bg-transparent border-none focus:ring-0 rounded px-1 py-1 w-full font-mono text-xs text-slate-700" placeholder="Código..." /></td>
                      <td className="px-6 py-4"><input type="text" value={p.descricao} onChange={(e) => updateProduct(p.id, { descricao: e.target.value })} className="bg-transparent border-none focus:ring-0 rounded px-1 py-1 w-full text-xs text-slate-700" placeholder="Descrição..." /></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-xs font-bold text-slate-700">R$ <input type="number" step="0.01" value={p.valorBonificacao} onChange={(e) => updateProduct(p.id, { valorBonificacao: parseFloat(e.target.value) || 0 })} className="bg-transparent border-none focus:ring-0 w-16" /></div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => updateProduct(p.id, { ativo: !p.ativo })} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${p.ativo ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>{p.ativo ? 'Ativo' : 'Inativo'}</button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => removeProduct(p.id)} className="text-slate-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === AppTab.Processamento && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-100">
                <div className="text-center mb-10">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-50 text-indigo-600 rounded-2xl mb-6"><FileUp size={40} /></div>
                  <h3 className="text-2xl font-bold text-slate-800">Processar Relatórios ERP</h3>
                </div>
                <div className="relative group">
                  <input type="file" multiple onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" accept="image/*,.pdf" />
                  <div className={`p-10 border-2 border-dashed rounded-2xl text-center ${selectedFiles.length > 0 ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200 bg-slate-50/50'}`}>
                    {selectedFiles.length > 0 ? <p className="text-sm font-bold text-indigo-700">{selectedFiles.length} arquivos prontos</p> : <p className="text-sm font-bold text-slate-700">Clique para anexar arquivos</p>}
                  </div>
                </div>
                {isLoading && (
                  <div className="mt-8 bg-indigo-50 rounded-2xl p-6 border border-indigo-100 space-y-4">
                    <p className="text-sm text-indigo-600/80 font-medium italic">{processingStatus}</p>
                    <div className="w-full bg-indigo-200/50 rounded-full h-2 overflow-hidden"><div className="bg-indigo-600 h-full animate-progress-indeterminate w-1/3 rounded-full"></div></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      <style>{`@keyframes progress-indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } } .animate-progress-indeterminate { animation: progress-indeterminate 1.5s infinite linear; }`}</style>
    </div>
  );
};

export default App;
