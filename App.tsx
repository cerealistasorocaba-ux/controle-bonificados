
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
  ChevronRight,
  TrendingUp,
  Users,
  DollarSign,
  FileSearch,
  History,
  LayoutGrid,
  ClipboardList
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

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.Dashboard);
  const [products, setProducts] = useState<BonusProduct[]>([]);
  const [history, setHistory] = useState<ProcessingHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [viewMode, setViewMode] = useState<Record<string, 'summary' | 'products'>>({});

  useEffect(() => {
    const savedProducts = localStorage.getItem('bonus_products');
    const savedHistory = localStorage.getItem('bonus_history');
    if (savedProducts) setProducts(JSON.parse(savedProducts));
    else setProducts(INITIAL_PRODUCTS);
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

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
    setIsLoading(true);
    setProcessingStatus('Iniciando extração inteligente...');
    
    try {
      const activeProds = products.filter(p => p.ativo);
      const consolidatedSellers: Record<string, SellerBonusSummary> = {};

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setProcessingStatus(`Lendo arquivo ${i + 1}/${selectedFiles.length}: ${file.name}`);
        const results = await processSalesReport(file, activeProds);
        
        results.forEach(newSeller => {
          const name = newSeller.vendedor.trim().toUpperCase();
          if (!consolidatedSellers[name]) {
            consolidatedSellers[name] = {
              vendedor: name,
              qtdePorBonus: {},
              vendasPorProduto: [],
              totalBonificacao: 0
            };
          }
          
          consolidatedSellers[name].totalBonificacao += newSeller.totalBonificacao;
          
          // Merge quantities by normalizing bonus value string keys
          Object.entries(newSeller.qtdePorBonus).forEach(([bonusValStr, qty]) => {
            const normalizedKey = parseFloat(bonusValStr).toFixed(2);
            consolidatedSellers[name].qtdePorBonus[normalizedKey as any] = 
              (consolidatedSellers[name].qtdePorBonus[normalizedKey as any] || 0) + qty;
          });

          // Merge product-specific quantities
          newSeller.vendasPorProduto.forEach(p => {
            const existingProd = consolidatedSellers[name].vendasPorProduto.find(ep => ep.descricao === p.descricao);
            if (existingProd) {
              existingProd.quantidade += p.quantidade;
            } else {
              consolidatedSellers[name].vendasPorProduto.push({ ...p });
            }
          });
        });
      }

      const allResults = Object.values(consolidatedSellers);
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
    } catch (error) {
      console.error(error);
      alert('Erro ao processar relatórios. Verifique sua chave de API e a qualidade das imagens.');
    } finally {
      setIsLoading(false);
      setProcessingStatus('');
    }
  };

  const toggleViewMode = (itemId: string) => {
    setViewMode(prev => ({
      ...prev,
      [itemId]: prev[itemId] === 'products' ? 'summary' : 'products'
    }));
  };

  const totalPagamentos = history.reduce((acc, curr) => acc + curr.totalBonificacao, 0);
  const totalProcessamentos = history.length;
  const totalSellersUnique = new Set(history.flatMap(h => h.detalhes.map(d => d.vendedor))).size;

  const chartData = history.slice(0, 10).reverse().map(h => ({
    data: new Date(h.dataProcessamento).toLocaleDateString('pt-BR'),
    total: h.totalBonificacao
  }));

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f1f5f9]">
      <aside className="w-full md:w-72 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-auto md:h-screen">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <TrendingUp size={24} />
            </div>
            <h1 className="font-bold text-xl text-slate-800 leading-tight">ERP Bonus<br/><span className="text-sm font-medium text-slate-400">Control System</span></h1>
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
            <p className="text-xs text-slate-400 uppercase font-bold mb-1">Status do Sistema</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <p className="text-sm font-medium text-slate-600">IA Ativa & Calibrada</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-slate-200 px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 capitalize">{TABS.find(t => t.id === activeTab)?.label}</h2>
            <p className="text-sm text-slate-500 mt-1">Sincronizado com relatórios do ERP.</p>
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
                {isLoading ? 'Extraindo...' : 'Processar Agora'}
              </button>
            )}
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {activeTab === AppTab.Dashboard && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5">
                  <div className="bg-blue-50 text-blue-600 p-4 rounded-xl"><DollarSign size={28} /></div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Total Acumulado</p>
                    <p className="text-2xl font-bold text-slate-900">R$ {totalPagamentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5">
                  <div className="bg-indigo-50 text-indigo-600 p-4 rounded-xl"><Users size={28} /></div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Equipe Bonificada</p>
                    <p className="text-2xl font-bold text-slate-900">{totalSellersUnique}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5">
                  <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl"><FileSearch size={28} /></div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Arquivos Processados</p>
                    <p className="text-2xl font-bold text-slate-900">{totalProcessamentos}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-6">Volume de Pagamentos</h3>
                  <div className="h-64">
                    {history.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="data" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                          <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#4f46e5' : '#c7d2fe'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <div className="flex items-center justify-center h-full bg-slate-50 rounded-xl border border-dashed border-slate-200"><p className="text-slate-400 text-sm">Aguardando dados.</p></div>}
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-slate-800">Processamentos Recentes</h3>
                    <button onClick={() => setActiveTab(AppTab.Historico)} className="text-indigo-600 text-sm font-semibold hover:underline">Ver Histórico</button>
                  </div>
                  <div className="space-y-4">
                    {history.length > 0 ? history.slice(0, 4).map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white hover:shadow-sm transition-all cursor-pointer group">
                        <div className="flex items-center gap-4">
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-slate-400 group-hover:text-indigo-500 transition-colors"><CheckCircle2 size={20} /></div>
                          <div>
                            <p className="text-sm font-semibold text-slate-700 truncate max-w-[180px]">{item.arquivoOrigem}</p>
                            <p className="text-xs text-slate-400">{new Date(item.dataProcessamento).toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900">R$ {item.totalBonificacao.toFixed(2)}</p>
                          <p className="text-xs text-slate-400">{item.totalVendedores} vended.</p>
                        </div>
                      </div>
                    )) : <div className="text-center py-10 text-slate-400 italic">Sem registros.</div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === AppTab.Configuracao && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Base de Produtos Bonificáveis</p>
                <span className="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-bold">{products.length} itens</span>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Código ERP</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Descrição do Produto</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Bonificação (R$)</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-center">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4"><input type="text" value={p.codigo} onChange={(e) => updateProduct(p.id, { codigo: e.target.value })} className="bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 rounded px-2 py-1 w-full font-mono text-sm text-slate-700" placeholder="Ex: 789..." /></td>
                      <td className="px-6 py-4"><input type="text" value={p.descricao} onChange={(e) => updateProduct(p.id, { descricao: e.target.value })} className="bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 rounded px-2 py-1 w-full text-sm text-slate-700" placeholder="Descrição..." /></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 w-max shadow-sm">
                          <span className="text-xs text-slate-400 font-bold">R$</span>
                          <input type="number" step="0.01" value={p.valorBonificacao} onChange={(e) => updateProduct(p.id, { valorBonificacao: parseFloat(e.target.value) || 0 })} className="bg-transparent border-none focus:outline-none w-16 text-sm font-bold text-slate-700" />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => updateProduct(p.id, { ativo: !p.ativo })} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${p.ativo ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>{p.ativo ? 'Ativo' : 'Inativo'}</button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => removeProduct(p.id)} className="text-slate-300 hover:text-red-500 p-2 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === AppTab.Processamento && (
            <div className="max-w-3xl mx-auto animate-in zoom-in-95 duration-300">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <div className="text-center mb-10">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl mb-6 ring-8 ring-indigo-50/50"><FileUp size={40} /></div>
                  <h3 className="text-2xl font-bold text-slate-800">Carregar Relatórios ERP</h3>
                  <p className="text-slate-500 mt-2 max-w-sm mx-auto">Nossa IA está configurada para ignorar pontos decimais (ex: 1.000 = 1 unidade) e capturar todos os itens bonificados configurados.</p>
                </div>
                <div className="relative group">
                  <input type="file" multiple onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" accept="image/*,.pdf" />
                  <div className={`p-10 border-2 border-dashed rounded-2xl text-center transition-all ${selectedFiles.length > 0 ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'}`}>
                    {selectedFiles.length > 0 ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap justify-center gap-2">
                          {selectedFiles.map((file, i) => <span key={i} className="px-3 py-1 bg-white border border-indigo-100 text-indigo-600 text-xs font-semibold rounded-lg shadow-sm">{file.name}</span>)}
                        </div>
                        <p className="text-sm font-bold text-indigo-700">{selectedFiles.length} arquivos prontos</p>
                      </div>
                    ) : (
                      <>
                        <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100 group-hover:scale-110 transition-transform"><Plus size={24} className="text-indigo-600" /></div>
                        <p className="text-sm font-bold text-slate-700">Clique para selecionar</p>
                        <p className="text-xs text-slate-400 mt-1">Imagens ou PDFs do ERP</p>
                      </>
                    )}
                  </div>
                </div>
                {isLoading && (
                  <div className="mt-8 bg-indigo-50/80 backdrop-blur rounded-2xl p-6 border border-indigo-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3"><Loader2 className="animate-spin text-indigo-600" size={20} /><p className="text-sm font-bold text-indigo-800">Sincronizando com IA...</p></div>
                      <span className="text-xs font-mono text-indigo-600 font-bold">GEMINI 3 PRO</span>
                    </div>
                    <p className="text-sm text-indigo-600/80 font-medium italic">{processingStatus}</p>
                    <div className="w-full bg-indigo-200/50 rounded-full h-2 overflow-hidden"><div className="bg-indigo-600 h-full animate-progress-indeterminate w-1/3 rounded-full"></div></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === AppTab.Historico && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              {history.length > 0 ? history.map((item) => {
                const isProductsView = viewMode[item.id] === 'products';
                // Get all unique products found in this processing run for the detailed view headers
                const allProductDescriptions = Array.from(new Set(item.detalhes.flatMap(d => d.vendasPorProduto.map(v => v.descricao)))).sort();

                return (
                  <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="bg-white p-3 rounded-xl border border-slate-200 text-emerald-600 shadow-sm"><CheckCircle2 size={24} /></div>
                        <div>
                          <p className="text-sm text-slate-400 font-bold uppercase tracking-wider">Extração Realizada em</p>
                          <h4 className="font-bold text-slate-800">{new Date(item.dataProcessamento).toLocaleString('pt-BR')}</h4>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                          <button 
                            onClick={() => toggleViewMode(item.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!isProductsView ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            <LayoutGrid size={14} /> Sumário
                          </button>
                          <button 
                            onClick={() => toggleViewMode(item.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isProductsView ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            <ClipboardList size={14} /> Detalhado
                          </button>
                        </div>
                        <div className="h-10 w-[1px] bg-slate-200 mx-2 hidden md:block"></div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Bonificado</p>
                          <p className="font-bold text-indigo-600 text-lg">R$ {item.totalBonificacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <button onClick={() => {
                          const csvContent = "data:text/csv;charset=utf-8,Vendedor,Bonificacao Total\n" + item.detalhes.map(d => `${d.vendedor},${d.totalBonificacao.toFixed(2)}`).join("\n");
                          const link = document.createElement("a");
                          link.setAttribute("href", encodeURI(csvContent));
                          link.setAttribute("download", `relatorio_${item.id}.csv`);
                          document.body.appendChild(link);
                          link.click();
                        }} className="bg-white border border-slate-200 p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-slate-500"><Download size={20} /></button>
                      </div>
                    </div>

                    <div className="p-0 overflow-x-auto">
                      {!isProductsView ? (
                        <table className="w-full text-left min-w-[600px]">
                          <thead className="bg-slate-50/30">
                            <tr>
                              <th className="px-8 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome do Vendedor</th>
                              <th className="px-8 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Detalhamento das Quantidades</th>
                              <th className="px-8 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Bonificação Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {/* Explicitly typing 'det' to resolve the 'unknown' error on 'vendedor.split' */}
                            {item.detalhes.map((det: SellerBonusSummary, idx: number) => (
                              <tr key={idx} className="hover:bg-indigo-50/20 transition-colors">
                                <td className="px-8 py-4 flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                    {(det.vendedor || '').split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                                  </div>
                                  <span className="font-semibold text-slate-700 text-sm uppercase">{det.vendedor}</span>
                                </td>
                                <td className="px-8 py-4">
                                  <div className="flex gap-2 flex-wrap">
                                    {Object.entries(det.qtdePorBonus).map(([val, qty]) => (
                                      <span key={val} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 shadow-sm flex items-center gap-1.5">
                                        <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">{qty}x</span>
                                        <span>de</span>
                                        <span className="font-bold">R$ {parseFloat(val).toFixed(2)}</span>
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
                              <th className="px-6 py-3 border border-slate-200 text-[10px] font-bold text-slate-500 uppercase">Vendedor</th>
                              {allProductDescriptions.map((desc, i) => (
                                <th key={i} className="px-4 py-3 border border-slate-200 text-[9px] font-bold text-slate-500 uppercase text-center max-w-[120px] truncate" title={desc}>
                                  {desc.split(' ').slice(0, 2).join(' ')}
                                </th>
                              ))}
                              <th className="px-6 py-3 border border-slate-200 text-[10px] font-bold text-slate-500 uppercase text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Explicitly typing 'det' to ensure consistent behavior across view modes */}
                            {item.detalhes.map((det: SellerBonusSummary, idx: number) => (
                              <tr key={idx} className="hover:bg-indigo-50/10 transition-colors">
                                <td className="px-6 py-3 border border-slate-200 text-xs font-semibold text-slate-700 whitespace-nowrap">{det.vendedor}</td>
                                {allProductDescriptions.map((desc, i) => {
                                  const qty = det.vendasPorProduto.find(v => v.descricao === desc)?.quantidade || 0;
                                  return (
                                    <td key={i} className={`px-4 py-3 border border-slate-200 text-center text-sm font-medium ${qty > 0 ? 'text-indigo-600 bg-indigo-50/30' : 'text-slate-300'}`}>
                                      {qty}
                                    </td>
                                  );
                                })}
                                <td className="px-6 py-3 border border-slate-200 text-right font-bold text-slate-900 text-xs whitespace-nowrap">
                                  R$ {det.totalBonificacao.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-slate-50 font-bold">
                              <td className="px-6 py-3 border border-slate-200 text-xs uppercase text-slate-500">SOMA TOTAL</td>
                              {allProductDescriptions.map((desc, i) => {
                                const totalQty = item.detalhes.reduce((acc, curr) => acc + (curr.vendasPorProduto.find(v => v.descricao === desc)?.quantidade || 0), 0);
                                return (
                                  <td key={i} className="px-4 py-3 border border-slate-200 text-center text-sm text-indigo-700">
                                    {totalQty}
                                  </td>
                                );
                              })}
                              <td className="px-6 py-3 border border-slate-200 text-right text-indigo-800 text-sm">
                                R$ {item.totalBonificacao.toFixed(2)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                );
              }) : <div className="bg-white p-20 rounded-3xl shadow-sm border border-slate-100 text-center"><History size={32} className="text-slate-300 mx-auto mb-6" /><p className="text-slate-500">Sem histórico de processamento.</p></div>}
            </div>
          )}
        </div>
      </main>
      <style>{`@keyframes progress-indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } } .animate-progress-indeterminate { animation: progress-indeterminate 1.5s infinite linear; }`}</style>
    </div>
  );
};

export default App;
