import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Settings as SettingsIcon, ShieldAlert, FileWarning, Fingerprint, Info, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Settings() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [rules, setRules] = useState({
    diasParaRevisaoMedica: 3,
    exigirCid: false,
    aceitarIncompleto: false,
    cidsBloqueados: [] as string[]
  });
  const [newCidBlock, setNewCidBlock] = useState('');

  useEffect(() => {
    // Apenas RH e Admins podem ver/editar configurações da empresa
    if (!profile || !['rh', 'admin'].includes(profile.role) || !profile.companyId) {
      setLoading(false);
      return;
    }

    const fetchCompanyData = async () => {
      try {
        const companyDoc = await getDoc(doc(db, 'companies', profile.companyId || ''));
        if (companyDoc.exists()) {
          const data = companyDoc.data();
          if (data.rules) {
            setRules(prev => ({ ...prev, ...data.rules }));
          }
        }
      } catch (err) {
        toast.error('Erro ao buscar configurações.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCompanyData();
  }, [profile]);

  const handleSave = async () => {
    if (!profile?.companyId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'companies', profile.companyId), {
        rules: rules,
        updatedAt: serverTimestamp()
      });
      toast.success('Motor de regras atualizado com sucesso!');
    } catch (err) {
      toast.error('Gatilho de segurança: Erro ao salvar regras.');
    } finally {
      setSaving(false);
    }
  };

  const handleCidRuleChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCidBlock.trim()) return;
    
    const formattedCid = newCidBlock.trim().toUpperCase();
    
    // Validação de formato CID 10 (Uma letra, dois números, e extensão opcional de 1 a 2 números com ou sem ponto)
    // Ex: M54, M54.5, M545, F32, F32.2
    const cidRegex = /^[A-Z][0-9]{2}(\.?[0-9]{1,2})?$/;
    
    if (!cidRegex.test(formattedCid)) {
      toast.error('Formato de CID inválido. Exemplos válidos: M54, F32.2, J019');
      return;
    }

    if (!rules.cidsBloqueados.includes(formattedCid)) {
      setRules(prev => ({
        ...prev,
        cidsBloqueados: [...prev.cidsBloqueados, formattedCid]
      }));
    } else {
      toast.error('Este CID já está na lista de bloqueados.');
    }
    setNewCidBlock('');
  };

  const removerCidBloqueado = (cidToRemove: string) => {
    setRules(prev => ({
      ...prev,
      cidsBloqueados: prev.cidsBloqueados.filter(c => c !== cidToRemove)
    }));
  };

  if (loading) return <div className="p-8 text-center">Carregando configurações...</div>;

  if (profile?.role === 'colaborador' || profile?.role === 'medico') {
    return <div className="p-8 text-center text-red-500 font-medium">Acesso negado. Apenas RH pode acessar o Motor de Regras.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          Motor de Regras (P.O.P)
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Configure a tolerância de risco e como a Inteligência Artificial deve classificar ou declinar os atestados da sua empresa.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 shadow-sm rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden divide-y divide-gray-200 dark:divide-gray-800">
        
        {/* Section 1 */}
        <div className="p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Gatilho de Afastamento Longo</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
                Redefina qual a quantidade de dias que exige que o Médico do Trabalho participe ativamente do aceite de um atestado.
              </p>
              
              <div className="flex items-center gap-4">
                <input 
                  type="number" 
                  min="1"
                  max="30"
                  value={rules.diasParaRevisaoMedica}
                  onChange={(e) => setRules({...rules, diasParaRevisaoMedica: parseInt(e.target.value) || 3})}
                  className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md text-gray-900 dark:text-white"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Dias concedidos</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2 */}
        <div className="p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg shrink-0">
              <FileWarning className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Rigor Documental</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
                Ajuste quão rígida a IA deve ser ao ler um documento incompleto ou sem CID preenchido.
              </p>
              
              <div className="space-y-4">
                <label className="flex items-start cursor-pointer group">
                  <div className="flex items-center h-5">
                    <input 
                      type="checkbox" 
                      checked={rules.exigirCid}
                      onChange={(e) => setRules({...rules, exigirCid: e.target.checked})}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800"
                    />
                  </div>
                  <div className="ml-3">
                    <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Exigir campo CID obrigatoriamente</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">Atestados sem a CID preenchida e lida pela IA serão retidos e encaminhados ao RH (mesmo de 1 dia).</span>
                  </div>
                </label>

                <label className="flex items-start cursor-pointer group">
                  <div className="flex items-center h-5">
                    <input 
                      type="checkbox" 
                      checked={rules.aceitarIncompleto}
                      onChange={(e) => setRules({...rules, aceitarIncompleto: e.target.checked})}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800"
                    />
                  </div>
                  <div className="ml-3">
                    <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Flexibilizar falta de carimbo</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">Se marcado, a IA tentará aprovar atestados legíveis mesmo se não detectar formalmente um carimbo no papel.</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3 */}
        <div className="p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg shrink-0">
              <Fingerprint className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Tolerância a Patologias (CID)</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
                A IA por padrão isola CIDs psiquiátricos (Grupo F). Se a sua empresa deseja bloquear atestados baseados em outras patologias e enviar para controle rigoroso, cadastre abaixo (ex: M54 - Dor lombar).
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 items-start">
                <form onSubmit={handleCidRuleChange} className="flex gap-2">
                  <input
                    type="text"
                    value={newCidBlock}
                    onChange={(e) => setNewCidBlock(e.target.value)}
                    placeholder="Ex: M54"
                    className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase"
                    maxLength={5}
                  />
                  <button type="submit" className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-white text-sm font-medium rounded-md transition-colors border border-gray-300 dark:border-gray-600">
                    Bloquear Categoria
                  </button>
                </form>
              </div>

              {rules.cidsBloqueados.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {rules.cidsBloqueados.map(cid => (
                    <span key={cid} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-red-50 dark:bg-red-900/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/60 shadow-sm">
                      {cid}
                      <button 
                         type="button"
                         onClick={() => removerCidBloqueado(cid)} 
                         className="p-0.5 hover:bg-red-200 dark:hover:bg-red-800/60 rounded-sm text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-100 transition-colors focus:outline-none focus:ring-1 focus:ring-red-500" 
                         title={`Remover bloqueio do CID ${cid}`}
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 dark:bg-gray-900/50 p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Info className="w-5 h-5" />
            As alterações passam a valer no próximo upload.
          </div>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-lg shadow-sm transition-all disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Aplicando...' : 'Salvar Motor de Regras'}
          </button>
        </div>

      </div>
    </div>
  );
}
