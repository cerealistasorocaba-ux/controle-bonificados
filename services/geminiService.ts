
import { GoogleGenAI, Type } from "@google/genai";
import { BonusProduct, SellerBonusSummary } from "../types";

export async function processSalesReport(
  file: File,
  activeProducts: BonusProduct[]
): Promise<SellerBonusSummary[]> {
  // Use gemini-3-pro-preview for complex extraction tasks as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result) {
        resolve(result.split(',')[1]);
      } else {
        reject(new Error("Falha ao ler o arquivo."));
      }
    };
    reader.onerror = () => reject(new Error("Erro na leitura do arquivo."));
    reader.readAsDataURL(file);
  });

  const productContext = activeProducts.map(p => 
    `- Código: ${p.codigo} | Descrição: ${p.descricao} | Valor Bônus: R$ ${p.valorBonificacao.toFixed(2)}`
  ).join('\n');

  const prompt = `
    Analise este relatório de vendas do ERP.
    
    LISTA DE PRODUTOS BONIFICADOS (CONTEXTO):
    ${productContext}

    REGRAS DE EXTRAÇÃO:
    1. Identifique os vendedores. O nome aparece após "Vendedor: [ID] - ".
    2. Localize as vendas dos produtos da lista acima para cada vendedor.
    3. ATENÇÃO À QUANTIDADE: No relatório, "1.000" significa 1 unidade, "2.000" significa 2 unidades. Ignore os zeros após o ponto se houver 3 casas decimais.
    4. Para cada vendedor, extraia:
       - Nome do vendedor.
       - Lista de produtos bonificados vendidos com suas respectivas descrições e quantidades.
       - Agrupamento das quantidades totais por valor unitário de bonificação.
       - Valor total de bonificação calculado (Soma de: Quantidade * Valor do Bônus).

    Retorne um JSON contendo uma lista de vendedores com seus respectivos dados de bônus e detalhamento por produto.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: file.type } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              vendedor: { type: Type.STRING },
              vendasPorProduto: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    descricao: { type: Type.STRING },
                    quantidade: { type: Type.NUMBER }
                  },
                  required: ["descricao", "quantidade"]
                }
              },
              detalhamentoBonificacao: { 
                type: Type.ARRAY,
                description: "Agrupamento por valor da bonificação",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    valor: { type: Type.NUMBER },
                    quantidade: { type: Type.NUMBER }
                  },
                  required: ["valor", "quantidade"]
                }
              },
              totalBonificacao: { type: Type.NUMBER }
            },
            required: ["vendedor", "vendasPorProduto", "detalhamentoBonificacao", "totalBonificacao"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    const rawData = JSON.parse(text);
    
    // Process results with type safety
    return rawData.map((item: any) => {
      const qtdePorBonus: Record<number, number> = {};
      if (Array.isArray(item.detalhamentoBonificacao)) {
        item.detalhamentoBonificacao.forEach((d: any) => {
          const v = parseFloat(d.valor);
          if (!isNaN(v)) {
            qtdePorBonus[v] = (qtdePorBonus[v] || 0) + (d.quantidade || 0);
          }
        });
      }
      return {
        vendedor: String(item.vendedor || 'VENDEDOR DESCONHECIDO'),
        qtdePorBonus,
        vendasPorProduto: (item.vendasPorProduto || []).map((p: any) => ({
          descricao: String(p.descricao || ''),
          quantidade: Number(p.quantidade || 0)
        })),
        totalBonificacao: Number(item.totalBonificacao || 0)
      };
    });
  } catch (error) {
    console.error("Erro ao processar com Gemini:", error);
    throw error;
  }
}
