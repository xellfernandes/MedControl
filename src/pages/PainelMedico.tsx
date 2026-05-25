import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, serverTimestamp, addDoc, getDoc } from 'firebase/firestore';
import { AlertTriangle, User, FileText, Check, X, Eye, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { sendNotification } from '../services/notificationService';

export default function PainelMedico() {
  const { profile } = useAuth();
  const [atestados, setAtestados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerAtestado, setViewerAtestado] = useState<any>(null);

  useEffect(() => {
    if (!profile || (profile.role !== 'medico' && profile.role !== 'admin' && profile.role !== 'superadmin')) return;

    let q;
    if (profile.role === 'superadmin') {
      q = query(
        collection(db, 'certificates'),
        where('status', '==', 'revisao_medica')
      );
    } else {
      q = query(
        collection(db, 'certificates'),
        where('companyId', '==', profile.companyId || 'DEFAULT_COMPANY'),
        where('status', '==', 'revisao_medica')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort in JS to avoid index requirement for companyId + status + createdAt
      data.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toMillis?.() || 0;
        const dateB = b.createdAt?.toMillis?.() || 0;
        return dateB - dateA;
      });

      setAtestados(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'certificates');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleDecisao = async (id: string, decisao: 'aceito' | 'rejeitado', colaboradorUid: string) => {
    try {
      const docRef = doc(db, 'certificates', id);
      await updateDoc(docRef, {
        status: decisao,
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'auditLogs'), {
        certificateId: id,
        action: `MEDICO_${decisao.toUpperCase()}`,
        performedByUid: profile?.uid,
        performedByName: profile?.name,
        details: `Atestado ${decisao} pelo médico do trabalho.`,
        createdAt: serverTimestamp()
      });

      // Fetch user to get email/phone
      try {
        const userDoc = await getDoc(doc(db, 'users', colaboradorUid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const message = `Olá ${userData.name}, seu atestado médico foi ${decisao} pelo Médico do Trabalho.`;
          
          await sendNotification({
            toEmail: userData.email,
            pushToken: userData.pushToken,
            subject: `Atualização do Atestado: ${decisao.toUpperCase()}`,
            message: message
          });
        }
      } catch (notifyError) {
        console.error("Failed to send notification:", notifyError);
        // Don't block the UI if notification fails
      }

      toast.success(`Atestado ${decisao} com sucesso.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `certificates/${id}`);
      toast.error('Erro ao salvar decisão.');
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Painel do Médico do Trabalho</h2>
        <p className="text-gray-500 dark:text-gray-400">Fila de atestados aguardando revisão médica.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {atestados.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 p-8 text-center rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <Check className="w-12 h-12 text-green-500 dark:text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Fila Vazia</h3>
            <p className="text-gray-500 dark:text-gray-400">Não há atestados aguardando revisão no momento.</p>
          </div>
        ) : (
          atestados.map((atestado) => (
            <div key={atestado.id} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                    <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{atestado.colaboradorName}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Enviado em: {atestado.createdAt?.toDate().toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                  <div>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">Dias</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{atestado.quantidadeDias}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">CID</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{atestado.cid || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">Emissão</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{atestado.dataEmissao}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">Médico</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100 truncate" title={atestado.medicoNome}>{atestado.medicoNome || 'N/A'}</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                    Motivos do Encaminhamento
                  </h4>
                  <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    {atestado.popRegrasAplicadas?.map((regra: string, idx: number) => (
                      <li key={idx}>{regra}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="md:w-64 flex flex-col gap-3 justify-center border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-800 pt-4 md:pt-0 md:pl-6">
                <button 
                  onClick={() => handleDecisao(atestado.id, 'aceito', atestado.colaboradorUid)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Aprovar Atestado
                </button>
                <button 
                  onClick={() => handleDecisao(atestado.id, 'rejeitado', atestado.colaboradorUid)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-md hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Rejeitar
                </button>
                <button 
                  onClick={() => setViewerAtestado(atestado)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Ver Documento
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Viewer */}
      {viewerAtestado && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                  <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    Revisão Médica: {viewerAtestado.colaboradorName}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Enviado em {viewerAtestado.createdAt?.toDate().toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewerAtestado(null)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Split View */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              
              {/* Left Column: Image/PDF Viewer */}
              <div className="w-full md:w-1/2 border-r border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-black/50 p-4 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                   <h4 className="font-medium text-gray-700 dark:text-gray-300 text-sm">Visualização do Documento</h4>
                </div>
                <div className="flex-1 relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex items-center justify-center">
                  {viewerAtestado.imageUrl && viewerAtestado.imageUrl.includes('.pdf') ? (
                    <object data={viewerAtestado.imageUrl} type="application/pdf" className="w-full h-full">
                      <p>Visualizador de PDF não disponível.</p>
                    </object>
                  ) : (
                    <img 
                      src={viewerAtestado.imageUrl || 'https://placeholder.com/atestado.jpg'} 
                      alt="Documento Anexado" 
                      className="max-w-full max-h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
              </div>

              {/* Right Column: Extracted Data & Actions */}
              <div className="w-full md:w-1/2 bg-white dark:bg-gray-900 overflow-y-auto p-6 space-y-8">
                
                {/* AI Extracted Data */}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-gray-800 pb-2">
                    Dados Extraídos da Triagem
                  </h4>
                  <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                    <div>
                      <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Nome do Paciente</span>
                      <span className="block mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{viewerAtestado.colaboradorName}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Médico Emissor / CRM</span>
                      <span className="block mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {viewerAtestado.medicoNome || 'N/A'} {viewerAtestado.medicoCRM ? `(CRM: ${viewerAtestado.medicoCRM})` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Data de Emissão</span>
                      <span className="block mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{viewerAtestado.dataEmissao}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Afatastamento</span>
                      <span className="block mt-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400">{viewerAtestado.quantidadeDias} dias</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">CID (Doença)</span>
                      <span className="block mt-1 text-sm font-semibold text-amber-600 dark:text-amber-500">{viewerAtestado.cid || 'Ausente'}</span>
                    </div>
                  </div>
                </div>

                {/* Motivos do Encaminhamento */}
                {viewerAtestado.popRegrasAplicadas && viewerAtestado.popRegrasAplicadas.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-gray-800 pb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                       Motivo(s) da Retenção
                    </h4>
                    <ul className="space-y-3 bg-amber-50 dark:bg-amber-900/10 p-4 rounded-lg border border-amber-100 dark:border-amber-900/30">
                      {viewerAtestado.popRegrasAplicadas.map((regra: string, idx: number) => (
                        <li key={idx} className="flex gap-3 text-sm">
                          <span className="text-amber-800 dark:text-amber-400 font-medium">
                            • {regra}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Raw AI Notes */}
                {viewerAtestado.observacoesMedicas && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-gray-800 pb-2">
                      Observações da Triagem Primária (IA)
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      {viewerAtestado.observacoesMedicas}
                    </p>
                  </div>
                )}

              </div>
            </div>
            
            {/* Footer Actions */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center gap-3">
              <button
                type="button"
                onClick={() => setViewerAtestado(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Voltar à Lista
              </button>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    handleDecisao(viewerAtestado.id, 'rejeitado', viewerAtestado.colaboradorUid);
                    setViewerAtestado(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 transition-colors"
                >
                  Documento Inválido (Rejeitar)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDecisao(viewerAtestado.id, 'aceito', viewerAtestado.colaboradorUid);
                    setViewerAtestado(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Liberar Atestado (Aprovar)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
