import { GoogleGenAI, Type, Schema } from '@google/genai';

// Initialize the Gemini API client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface OcrResult {
  nomeColaborador: string | null;
  cpfOuMatricula: string | null;
  dataEmissao: string | null;
  dataInicioAfastamento: string | null;
  quantidadeDias: number | null;
  cid: string | null;
  medicoNome: string | null;
  medicoCRM: string | null;
  instituicao: string | null;
  horarioInicio: string | null;
  horarioFim: string | null;
  assinaturaOuCarimboPresente: boolean;
  tipoDocumento: 'atestado' | 'comparecimento' | 'exame' | 'receita' | 'laudo' | 'encaminhamento' | 'outro';
  legivel: boolean;
  observacoes: string | null;
  rawText: string;
}

const ocrSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    nomeColaborador: { type: Type.STRING, description: "Nome do paciente/colaborador" },
    cpfOuMatricula: { type: Type.STRING, description: "CPF ou número de matrícula, se houver" },
    dataEmissao: { type: Type.STRING, description: "Data em que o documento foi emitido (formato YYYY-MM-DD)" },
    dataInicioAfastamento: { type: Type.STRING, description: "Data de início do afastamento (formato YYYY-MM-DD)" },
    quantidadeDias: { type: Type.INTEGER, description: "Quantidade de dias de afastamento concedidos. Se for apenas horas ou comparecimento, retorne 0." },
    cid: { type: Type.STRING, description: "Código CID (Classificação Internacional de Doenças), se constar" },
    medicoNome: { type: Type.STRING, description: "Nome do médico que assina" },
    medicoCRM: { type: Type.STRING, description: "Número do CRM do médico e UF (ex: 12345/SP)" },
    instituicao: { type: Type.STRING, description: "Nome do hospital, clínica ou posto de saúde" },
    horarioInicio: { type: Type.STRING, description: "Horário de início do atendimento ou afastamento (formato HH:MM), se constar" },
    horarioFim: { type: Type.STRING, description: "Horário de fim do atendimento ou afastamento (formato HH:MM), se constar" },
    assinaturaOuCarimboPresente: { type: Type.BOOLEAN, description: "Verdadeiro se houver assinatura ou carimbo visível" },
    tipoDocumento: { 
      type: Type.STRING, 
      enum: ['atestado', 'comparecimento', 'exame', 'receita', 'laudo', 'encaminhamento', 'outro'],
      description: "Classificação do tipo de documento"
    },
    legivel: { type: Type.BOOLEAN, description: "Verdadeiro se o documento for legível o suficiente para extrair os dados principais" },
    observacoes: { type: Type.STRING, description: "Outras observações importantes, como restrições laborais, necessidade de repouso, etc." },
    rawText: { type: Type.STRING, description: "Transcrição fiel de todo o texto encontrado no documento" }
  },
  required: ["assinaturaOuCarimboPresente", "tipoDocumento", "legivel", "rawText"]
};

export async function processAtestadoImage(base64Image: string, mimeType: string): Promise<OcrResult> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Você é um assistente especializado em auditoria médica e RH.
              Analise a imagem deste documento médico e extraia as informações solicitadas com precisão.
              Seja rigoroso na classificação do tipo de documento. Um atestado médico deve conceder dias de afastamento.
              Uma declaração de comparecimento apenas justifica horas.
              Se um campo não puder ser lido ou não existir, retorne null.`
            },
            {
              inlineData: {
                data: base64Image,
                mimeType: mimeType
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: ocrSchema,
        temperature: 0.1, // Low temperature for more deterministic extraction
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No text returned from Gemini API");
    }

    return JSON.parse(text) as OcrResult;
  } catch (error) {
    console.error("Error processing image with Gemini:", error);
    throw error;
  }
}
