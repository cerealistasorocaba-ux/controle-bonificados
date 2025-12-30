
import { GoogleGenAI, Type } from "@google/genai";
import { BonusProduct, SellerBonusSummary } from "../types";

export async function processSalesReport(
  file: File,
  activeProducts: BonusProduct[],
  manualKey?: string
): Promise<SellerBonusSummary[]> {
  const apiKey = manualKey || process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API Key não configurada.");
  }

  const ai = new GoogleGenAI({ apiKey });

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
    Analise este relatório de vendas da Cerealista Sorocaba.
    
    LISTA DE PRODUTOS BONIFICADOS:
    ${productContext}

    REGRAS CRÍTICAS DE EXTRAÇÃO:
    1. IDENTIFICAÇÃO DO VENDEDOR: Localize a linha que começa com "Vendedor:". 
       - O formato é sempre "Vendedor: [CÓDIGO] - [NOME]".
       - Extraia o CÓDIGO (ex: 19, 27, 41) e o NOME (ex: MAYARA ALVES...) separadamente.
       - Se encontrar um vendedor sem código, atribua "0" ao código.
    2. Localize as vendas dos produtos da lista mencionada acima.
    3. TRATAMENTO DE QUANTIDADE: No relatório, o ponto é separador de milhar com 3 casas decimais (Ex: "1.000" = 1 unidade, "2.000" = 2 unidades). Extraia o valor INTEIRO real vendido.
    4. Ignore produtos que não estão na lista de contexto acima.
    5. Calcule a bonificação: (Quantidade Total Vendida de cada produto * Valor do Bônus correspondente).

    Retorne um JSON estruturado com os dados extraídos, agrupando por CÓDIGO de vendedor.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
              codigoVendedor: { type: Type.STRING },
              vendedor: { type: Type.STRING, description: "Nome do vendedor" },
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
            required: ["codigoVendedor", "vendedor", "vendasPorProduto", "detalhamentoBonificacao", "totalBonificacao"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    const rawData = JSON.parse(text);
    
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
        codigoVendedor: String(item.codigoVendedor || '0'),
        vendedor: String(item.vendedor || 'DESCONHECIDO').toUpperCase(),
        qtdePorBonus,
        vendasPorProduto: (item.vendasPorProduto || []).map((p: any) => ({
          descricao: String(p.descricao || '').toUpperCase(),
          quantidade: Number(p.quantidade || 0)
        })),
        totalBonificacao: Number(item.totalBonificacao || 0)
      };
    });
  } catch (error) {
    console.error("Erro Gemini:", error);
    throw error;
  }
}
