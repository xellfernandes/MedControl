import { OcrResult } from './ocrService';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export interface PopRuleResult {
  status: 'aceito' | 'aceito_com_pendencia' | 'revisao_medica' | 'encaminhado_rh' | 'rejeitado' | 'pendente_validacao';
  regrasAplicadas: string[];
  observacoes: string;
}

export interface CompanyRules {
  diasParaRevisaoMedica: number;
  exigirCid: boolean;
  aceitarIncompleto: boolean;
  cidsBloqueados: string[];
}

const DEFAULT_RULES: CompanyRules = {
  diasParaRevisaoMedica: 3,
  exigirCid: false,
  aceitarIncompleto: false,
  cidsBloqueados: []
};

// Mock function to simulate history check - in a real app, this would query Firestore
async function checkHistory(colaboradorUid: string) {
  // Simulating history
  return {
    atestadosUltimos30Dias: 1,
    diasAfastadosUltimos60Dias: 2,
    cidsRecorrentes: [] as string[],
    funcaoCritica: false
  };
}

export async function applyPopRules(ocrData: OcrResult, colaboradorUid: string, companyId?: string): Promise<PopRuleResult> {
  let companyRules = DEFAULT_RULES;

  // Buscar regras da empresa do BD (if applicable)
  if (companyId && companyId !== 'DEFAULT_COMPANY') {
     try {
       const companyDoc = await getDoc(doc(db, 'companies', companyId));
       if (companyDoc.exists()) {
           const data = companyDoc.data();
           if (data.rules) {
               companyRules = { ...DEFAULT_RULES, ...data.rules };
           }
       }
     } catch (e) {
       console.error("Erro lendo regras da empresa. Usando padrão.", e);
     }
  }

  const regrasAplicadas: string[] = [];
  let status: PopRuleResult['status'] = 'aceito';
  let observacoes = '';

  // 1. Validação Documental Básica (Opcionais guiadas pela Regra)
  if (!ocrData.legivel && !companyRules.aceitarIncompleto) {
    return {
      status: 'pendente_validacao',
      regrasAplicadas: ['Documento ilegível'],
      observacoes: 'O documento não pôde ser lido corretamente pela IA. Arquivado para leitura manual baseada nas regras da empresa.'
    };
  }

  if (!ocrData.assinaturaOuCarimboPresente && !companyRules.aceitarIncompleto) {
    regrasAplicadas.push('Falta assinatura/carimbo');
    status = 'pendente_validacao';
  }

  if (companyRules.exigirCid && (!ocrData.cid || ocrData.cid.trim() === '')) {
     regrasAplicadas.push('Falta CID OBRIGATÓRIO (Exigência da Empresa)');
     status = 'encaminhado_rh'; 
     // RH decide se releva
  }

  // Se já falhou gravemente
  if (status === 'pendente_validacao') {
    return { status, regrasAplicadas, observacoes: 'Pendência documental bloqueante detectada pela Gestão de Risco.' };
  }

  // 2. Regras de Negócio Dinâmicas
  const history = await checkHistory(colaboradorUid);

  // Regra Dinâmica: Atestado Longo (Customizável)
  if (ocrData.quantidadeDias && ocrData.quantidadeDias >= companyRules.diasParaRevisaoMedica) {
    regrasAplicadas.push(`Atestado longo (>= ${companyRules.diasParaRevisaoMedica} dias)`);
    status = 'revisao_medica';
  }

  // Regra Dinâmica: CIDs bloqueados ou de alerta
  if (ocrData.cid) {
    const rawCid = ocrData.cid.toUpperCase().trim();
    // Psiquiatria é padrão bloqueado unless removed, mas usamos a array dinâmica se existir
    if (rawCid.startsWith('F')) {
      regrasAplicadas.push('Atenção: CID Psiquiátrico detectado');
      status = 'revisao_medica';
    }

    if (companyRules.cidsBloqueados.some(c => rawCid.startsWith(c.toUpperCase()))) {
      regrasAplicadas.push(`Alerta Restrito: CID ${rawCid} bloqueado administrativamente`);
      status = 'encaminhado_rh';
    }
  }

  // Regra Fixa: 3 atestados em 30 dias (Anti-fraude)
  if (history.atestadosUltimos30Dias >= 2) { 
    regrasAplicadas.push('Múltiplos atestados em 30 dias');
    status = 'revisao_medica';
  }

  // Default clean run
  if (regrasAplicadas.length === 0) {
    regrasAplicadas.push('Análise concluída (Conformidade 100%)');
  }

  return {
    status,
    regrasAplicadas,
    observacoes: status === 'revisao_medica' ? 'Afastamento enviado para análise clínica por enquadramento de regra automatizada.' : ''
  };
}
