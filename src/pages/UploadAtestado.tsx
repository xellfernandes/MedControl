import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { processAtestadoImage, OcrResult } from '../services/ocrService';
import { applyPopRules, PopRuleResult } from '../services/popRulesService';
import { db, handleFirestoreError, OperationType, storage } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import toast from 'react-hot-toast';
import { UploadCloud, CheckCircle, AlertTriangle, FileText, Loader2, Edit2, Zap, Hand } from 'lucide-react';

import { sendNotification } from '../services/notificationService';
import { doc, getDoc } from 'firebase/firestore';

export default function UploadAtestado() {
  const { profile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [editedOcrResult, setEditedOcrResult] = useState<OcrResult | null>(null);
  const [popResult, setPopResult] = useState<PopRuleResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [popError, setPopError] = useState<string | null>(null);
  const [companyPlan, setCompanyPlan] = useState<string>('starter');

  useEffect(() => {
    const fetchPlan = async () => {
      if (!profile?.companyId) return;
      try {
        const companyDoc = await getDoc(doc(db, 'companies', profile.companyId));
        if (companyDoc.exists()) {
          const data = companyDoc.data();
          if (data.plan) {
             setCompanyPlan(data.plan);
          }
        }
      } catch (err) {
        console.error("Erro ao buscar plano da empresa", err);
      }
    };
    fetchPlan();
  }, [profile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setOcrResult(null);
      setEditedOcrResult(null);
      setPopResult(null);
      setOcrError(null);
      setPopError(null);
    }
  };

  const handleProcess = async () => {
    if (!file) return;

    setIsProcessing(true);
    setOcrError(null);
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          // 1. Run OCR
          toast.loading('Analisando documento com IA...', { id: 'ocr' });
          const extractedData = await processAtestadoImage(base64String, file.type);
          setOcrResult(extractedData);
          setEditedOcrResult(extractedData);
          toast.success('Extração concluída! Verifique os dados.', { id: 'ocr' });
          setIsProcessing(false);
        } catch (error) {
          console.error(error);
          setOcrError('Falha ao extrair dados do documento. A imagem pode estar embaçada, escura ou o formato não foi reconhecido pela IA.');
          toast.error('Erro na extração de dados.', { id: 'ocr' });
          setIsProcessing(false);
        }
      };
    } catch (error) {
      console.error(error);
      setOcrError('Erro ao ler o arquivo no navegador. Tente enviar um arquivo diferente.');
      toast.error('Erro ao processar o documento.', { id: 'ocr' });
      setIsProcessing(false);
    }
  };

  const handleApplyRules = async () => {
    if (!editedOcrResult || !profile) return;
    setPopError(null);
    
    const missingFields = [];
    if (!editedOcrResult.nomeColaborador?.trim()) missingFields.push('Paciente');
    if (!editedOcrResult.tipoDocumento) missingFields.push('Tipo de Documento');
    if (!editedOcrResult.dataEmissao) missingFields.push('Data de Emissão');
    if (!editedOcrResult.dataInicioAfastamento) missingFields.push('Início do Afastamento');
    if (editedOcrResult.quantidadeDias === null || editedOcrResult.quantidadeDias === undefined || editedOcrResult.quantidadeDias < 0) {
      missingFields.push('Dias de Afastamento');
    }

    if (missingFields.length > 0) {
      const errorMsg = `Campos obrigatórios ausentes: ${missingFields.join(', ')}.`;
      setPopError(errorMsg);
      toast.error('Preencha os campos destacados antes de prosseguir.');
      return;
    }
    
    try {
      toast.loading('Aplicando regras do P.O.P...', { id: 'pop' });
      const rulesResult = await applyPopRules(editedOcrResult, profile.uid, profile.companyId);
      setPopResult(rulesResult);
      toast.success('Regras aplicadas!', { id: 'pop' });
    } catch (error) {
      console.error(error);
      setPopError('Ocorreu um erro interno ao tentar aplicar as regras do P.O.P. (Medicina do Trabalho). Tente novamente em alguns instantes.');
      toast.error('Geração de regras falhou.', { id: 'pop' });
    }
  };

  const handleEditData = () => {
    setPopResult(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!editedOcrResult) return;
    const { name, value } = e.target;
    
    setEditedOcrResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [name]: name === 'quantidadeDias' ? (value ? parseInt(value, 10) : null) : value
      };
    });
  };

  const handleSave = async () => {
    if (!editedOcrResult || !popResult || !profile) return;

    setIsSaving(true);
    let downloadUrl = 'https://placeholder.com/atestado.jpg'; // default fallback

    try {
      // 1. Upload the image to Firebase Storage if we have a file
      if (file) {
        toast.loading('Fazendo upload seguro da imagem...', { id: 'save' });
        const fileExt = file.name.split('.').pop() || 'jpg';
        // Organize logs by company -> date -> user -> precise timestamp
        const filePath = `certificates/${profile.companyId || 'DEFAULT'}/${new Date().toISOString().split('T')[0]}/${profile.uid}/${Date.now()}.${fileExt}`;
        const storageRef = ref(storage, filePath);
        
        try {
          const snapshot = await uploadBytesResumable(storageRef, file);
          downloadUrl = await getDownloadURL(snapshot.ref);
          toast.success('Upload de arquivo concluído.', { id: 'save' });
        } catch (uploadError) {
           console.error("Falha no upload para o storage", uploadError);
           toast.error('Erro ao armazenar a imagem real. Utilizando fallback.');
        }
      }

      toast.loading('Contabilizando os dados...', { id: 'save' });

      // Check for duplicate certificates
      const certificatesRef = collection(db, 'certificates');
      const duplicateQuery = query(
        certificatesRef,
        where('colaboradorUid', '==', profile.uid),
        where('dataEmissao', '==', editedOcrResult.dataEmissao),
        where('quantidadeDias', '==', editedOcrResult.quantidadeDias)
      );
      
      const duplicateSnapshot = await getDocs(duplicateQuery);
      if (!duplicateSnapshot.empty) {
        toast.error('Um atestado com os mesmos dados (data de emissão e dias) já foi enviado.', { id: 'save' });
        setIsSaving(false);
        return;
      }

      const certificateData = {
        colaboradorUid: profile.uid,
        colaboradorName: profile.name,
        companyId: profile.companyId || 'DEFAULT_COMPANY',
        dataEmissao: editedOcrResult.dataEmissao,
        dataInicioAfastamento: editedOcrResult.dataInicioAfastamento,
        quantidadeDias: editedOcrResult.quantidadeDias,
        cid: editedOcrResult.cid,
        medicoNome: editedOcrResult.medicoNome,
        medicoCRM: editedOcrResult.medicoCRM,
        instituicao: editedOcrResult.instituicao,
        horarioInicio: editedOcrResult.horarioInicio,
        horarioFim: editedOcrResult.horarioFim,
        tipoDocumento: editedOcrResult.tipoDocumento,
        status: popResult.status,
        ocrRawText: editedOcrResult.rawText,
        popRegrasAplicadas: popResult.regrasAplicadas,
        observacoesMedicas: popResult.observacoes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        imageUrl: downloadUrl 
      };

      const docRef = await addDoc(collection(db, 'certificates'), certificateData);
      
      // Create Audit Log
      await addDoc(collection(db, 'auditLogs'), {
        certificateId: docRef.id,
        action: 'CREATED_AND_PROCESSED',
        performedByUid: profile.uid,
        performedByName: profile.name,
        details: `Documento processado via OCR. Status definido como: ${popResult.status}`,
        createdAt: serverTimestamp()
      });

      // Send notification to the user
      try {
        const userDoc = await getDoc(doc(db, 'users', profile.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          await sendNotification({
            toEmail: userData.email,
            pushToken: userData.pushToken,
            subject: 'Atestado Recebido',
            message: `Olá ${userData.name}, seu atestado foi recebido e o status atual é: ${popResult.status.replace(/_/g, ' ')}.`
          });
        }
      } catch (notifyError) {
        console.error("Failed to send notification:", notifyError);
      }

      toast.success('Atestado enviado com sucesso!', { id: 'save' });
      // Reset form
      setFile(null);
      setPreviewUrl(null);
      setOcrResult(null);
      setEditedOcrResult(null);
      setPopResult(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'certificates');
      toast.error('Erro ao salvar o atestado.', { id: 'save' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Enviar Atestado</h2>
        <p className="text-gray-500 dark:text-gray-400">Faça o upload do seu atestado médico para análise automática.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Upload & Preview */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
            {!previewUrl ? (
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-12 text-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <UploadCloud className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                <div className="mt-4 flex text-sm leading-6 text-gray-600 dark:text-gray-400 justify-center">
                  <label htmlFor="file-upload" className="relative cursor-pointer rounded-md bg-transparent font-semibold text-indigo-600 dark:text-indigo-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500">
                    <span>Faça upload de um arquivo</span>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/jpeg, image/png, application/pdf" onChange={handleFileChange} />
                  </label>
                </div>
                <p className="text-xs leading-5 text-gray-500 dark:text-gray-500">PNG, JPG, PDF até 10MB</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 aspect-[3/4] flex items-center justify-center">
                  {file?.type === 'application/pdf' ? (
                    <object data={previewUrl} type="application/pdf" className="w-full h-full">
                      <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 p-4 text-center">
                        <FileText className="w-12 h-12 mb-2 text-gray-400 dark:text-gray-500 mx-auto" />
                        <p className="text-sm">PDF carregado com sucesso.</p>
                      </div>
                    </object>
                  ) : (
                    <img src={previewUrl} alt="Preview" className="max-h-full object-contain" />
                  )}
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => { setFile(null); setPreviewUrl(null); setOcrResult(null); setEditedOcrResult(null); setPopResult(null); }}
                    className="flex-1 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Trocar Arquivo
                  </button>
                  
                  {companyPlan === 'starter' ? (
                    <button 
                      onClick={() => {
                        const manualEmpty: OcrResult = {
                          nomeColaborador: profile?.name || '',
                          cpfOuMatricula: '', dataEmissao: '', dataInicioAfastamento: '',
                          quantidadeDias: 0, cid: '', medicoNome: '', medicoCRM: '', instituicao: '',
                          horarioInicio: '', horarioFim: '', assinaturaOuCarimboPresente: true,
                          tipoDocumento: 'atestado', legivel: true, observacoes: '', rawText: 'PREENCHIMENTO MANUAL'
                        };
                        setEditedOcrResult(manualEmpty);
                        toast.success('Formulário manual ativado.');
                      }}
                      disabled={!!ocrResult || !!editedOcrResult}
                      className="flex-1 px-4 py-2 bg-gray-600 dark:bg-gray-700 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                      <Hand className="w-4 h-4" /> Preencher Código
                    </button>
                  ) : (
                    <button 
                      onClick={handleProcess}
                      disabled={isProcessing || !!ocrResult}
                      className="flex-1 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Zap className="w-4 h-4 fill-white" /> Analisar com IA</>}
                    </button>
                  )}
                </div>
                
                {companyPlan === 'starter' && (
                  <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-md text-sm text-indigo-700 dark:text-indigo-400 flex items-start gap-2">
                    <Zap className="w-5 h-5 shrink-0 mt-0.5 text-indigo-500" />
                    <div>
                      <span className="font-semibold block">Funcionalidade PRO bloqueada</span>
                      Seu plano atual exige preenchimento manual dos atestados. Atualize para o plano PRO para destravar a leitura inteligente por IA.
                    </div>
                  </div>
                )}

                {ocrError && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg text-sm text-red-800 dark:text-red-300">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="block font-semibold">Falha na Inteligência Artificial</span>
                        <p className="mt-1">{ocrError}</p>
                        <div className="mt-3 bg-white dark:bg-red-900/40 p-3 rounded-md border border-red-100 dark:border-red-800/30">
                          <span className="font-medium text-red-900 dark:text-red-200 text-xs uppercase tracking-wider">💡 Sugestão:</span>
                          <ul className="mt-1 list-disc list-inside text-red-700 dark:text-red-300 space-y-1">
                            <li>Tente fazer o upload de uma imagem mais nítida.</li>
                            <li>Certifique-se que o documento está bem iluminado.</li>
                            <li>Se o sistema falhar repetidamente, clique em "Preencher Código" para digitar manualmente.</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: OCR Results & POP Rules */}
        <div className="space-y-6">
          {editedOcrResult && (
            <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Dados Extraídos (OCR)
                </h3>
                {popResult && (
                  <button 
                    onClick={handleEditData}
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Edit2 className="w-4 h-4" /> Editar
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="block text-gray-500 dark:text-gray-400 mb-1">
                    Paciente <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    name="nomeColaborador" 
                    value={editedOcrResult.nomeColaborador || ''} 
                    onChange={handleInputChange}
                    disabled={!!popResult}
                    className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:bg-gray-50 dark:disabled:bg-gray-900 overflow-hidden focus:outline-none focus:ring-1 focus:ring-indigo-500 ${!editedOcrResult.nomeColaborador?.trim() ? 'border-red-300 dark:border-red-500/50 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-700'}`}
                  />
                  {!editedOcrResult.nomeColaborador?.trim() && (
                    <p className="mt-1 text-xs text-red-500">Campo obrigatório.</p>
                  )}
                </div>
                <div>
                  <label className="block text-gray-500 dark:text-gray-400 mb-1">
                    Tipo <span className="text-red-500">*</span>
                  </label>
                  <select 
                    name="tipoDocumento" 
                    value={editedOcrResult.tipoDocumento} 
                    onChange={handleInputChange}
                    disabled={!!popResult}
                    className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:bg-gray-50 dark:disabled:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 capitalize ${!editedOcrResult.tipoDocumento ? 'border-red-300 dark:border-red-500/50 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-700'}`}
                  >
                    <option value="">Selecione o tipo</option>
                    <option value="atestado">Atestado</option>
                    <option value="comparecimento">Comparecimento</option>
                    <option value="exame">Exame</option>
                    <option value="receita">Receita</option>
                    <option value="laudo">Laudo</option>
                    <option value="encaminhamento">Encaminhamento</option>
                    <option value="outro">Outro</option>
                  </select>
                  {!editedOcrResult.tipoDocumento && (
                    <p className="mt-1 text-xs text-red-500">Campo obrigatório.</p>
                  )}
                </div>
                <div>
                  <label className="block text-gray-500 dark:text-gray-400 mb-1">
                    Data de Emissão <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="date" 
                    name="dataEmissao" 
                    value={editedOcrResult.dataEmissao || ''} 
                    onChange={handleInputChange}
                    disabled={!!popResult}
                    className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:bg-gray-50 dark:disabled:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${!editedOcrResult.dataEmissao ? 'border-red-300 dark:border-red-500/50 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-700'}`}
                  />
                  {!editedOcrResult.dataEmissao && (
                    <p className="mt-1 text-xs text-red-500">Campo obrigatório.</p>
                  )}
                </div>
                <div>
                  <label className="block text-gray-500 dark:text-gray-400 mb-1">
                    Início do Afastamento <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="date" 
                    name="dataInicioAfastamento" 
                    value={editedOcrResult.dataInicioAfastamento || ''} 
                    onChange={handleInputChange}
                    disabled={!!popResult}
                    className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:bg-gray-50 dark:disabled:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${!editedOcrResult.dataInicioAfastamento ? 'border-red-300 dark:border-red-500/50 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-700'}`}
                  />
                  {!editedOcrResult.dataInicioAfastamento && (
                    <p className="mt-1 text-xs text-red-500">Campo obrigatório.</p>
                  )}
                </div>
                <div>
                  <label className="block text-gray-500 dark:text-gray-400 mb-1">Horário de Início</label>
                  <input 
                    type="time" 
                    name="horarioInicio" 
                    value={editedOcrResult.horarioInicio || ''} 
                    onChange={handleInputChange}
                    disabled={!!popResult}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-500 dark:disabled:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-500 dark:text-gray-400 mb-1">Horário de Fim</label>
                  <input 
                    type="time" 
                    name="horarioFim" 
                    value={editedOcrResult.horarioFim || ''} 
                    onChange={handleInputChange}
                    disabled={!!popResult}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-500 dark:disabled:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-500 dark:text-gray-400 mb-1">
                    Dias de Afastamento <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="number" 
                    name="quantidadeDias" 
                    value={editedOcrResult.quantidadeDias ?? ''} 
                    onChange={handleInputChange}
                    disabled={!!popResult}
                    className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:bg-gray-50 dark:disabled:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${editedOcrResult.quantidadeDias === null || editedOcrResult.quantidadeDias === undefined || editedOcrResult.quantidadeDias < 0 ? 'border-red-300 dark:border-red-500/50 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-700'}`}
                  />
                  {(editedOcrResult.quantidadeDias === null || editedOcrResult.quantidadeDias === undefined || editedOcrResult.quantidadeDias < 0) && (
                    <p className="mt-1 text-xs text-red-500">Campo obrigatório.</p>
                  )}
                </div>
                <div>
                  <label className="block text-gray-500 dark:text-gray-400 mb-1">CID</label>
                  <input 
                    type="text" 
                    name="cid" 
                    value={editedOcrResult.cid || ''} 
                    onChange={handleInputChange}
                    disabled={!!popResult}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-500 dark:disabled:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-500 dark:text-gray-400 mb-1">Médico</label>
                  <input 
                    type="text" 
                    name="medicoNome" 
                    value={editedOcrResult.medicoNome || ''} 
                    onChange={handleInputChange}
                    disabled={!!popResult}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-500 dark:disabled:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-500 dark:text-gray-400 mb-1">CRM</label>
                  <input 
                    type="text" 
                    name="medicoCRM" 
                    value={editedOcrResult.medicoCRM || ''} 
                    onChange={handleInputChange}
                    disabled={!!popResult}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-500 dark:disabled:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {!popResult && (
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                  {popError && (
                    <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg text-sm text-red-800 dark:text-red-300">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="block font-semibold">Erro de Validação</span>
                          <p className="mt-1">{popError}</p>
                          <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                            💡 Corrija os campos <span className="underline">destacados em vermelho</span> acima.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={handleApplyRules}
                    className="w-full px-4 py-2 bg-indigo-600 dark:bg-indigo-500 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Aplicar Regras do P.O.P.
                  </button>
                </div>
              )}
            </div>
          )}

          {popResult && (
            <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 animate-in fade-in slide-in-from-bottom-4 delay-150">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                Análise do P.O.P.
              </h3>
              
              <div className="mb-4">
                <span className="text-sm text-gray-500 dark:text-gray-400 block mb-1">Decisão do Sistema:</span>
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 capitalize">
                  {popResult.status.replace(/_/g, ' ')}
                </div>
              </div>

              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400 block mb-2">Regras Aplicadas:</span>
                <ul className="space-y-2">
                  {popResult.regrasAplicadas.map((regra, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      {regra}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full px-4 py-3 bg-green-600 dark:bg-green-500 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 flex justify-center items-center"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                  {isSaving ? 'Salvando...' : 'Confirmar e Enviar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
