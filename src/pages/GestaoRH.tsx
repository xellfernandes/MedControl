import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, doc, getDoc, updateDoc, serverTimestamp, where } from 'firebase/firestore';
import { Users, TrendingUp, AlertCircle, Search, Bell, Download, Eye, X, CheckCircle, FileText, Mail } from 'lucide-react';
import { CertificateIcon } from '../components/CertificateIcon';
import toast from 'react-hot-toast';
import { sendNotification } from '../services/notificationService';

export default function GestaoRH() {
  const { profile } = useAuth();
  const [atestados, setAtestados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Modal states for Reminder
  const [selectedAtestado, setSelectedAtestado] = useState<any>(null);
  const [reminderMessage, setReminderMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Modal states for Viewer
  const [viewerAtestado, setViewerAtestado] = useState<any>(null);

  const [hasNotifiedDelay, setHasNotifiedDelay] = useState(false);

  useEffect(() => {
    if (!profile || (profile.role !== 'rh' && profile.role !== 'admin' && profile.role !== 'superadmin')) return;


    let q;
    if (profile.role === 'superadmin') {
      q = query(
        collection(db, 'certificates')
      );
    } else {
      q = query(
        collection(db, 'certificates'),
        where('companyId', '==', profile.companyId || 'DEFAULT_COMPANY')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort in Javascript instead of firestore to prevent composite index request error
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

  const isOverdue = (atestado: any) => {
    if (atestado.status !== 'pendente_validacao') return false;
    
    // Using updatedAt or createdAt to check duration
    const date = atestado.updatedAt ? atestado.updatedAt.toDate() : (atestado.createdAt ? atestado.createdAt.toDate() : null);
    if (!date) return false;

    const diffTime = new Date().getTime() - date.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays >= 3;
  };

  useEffect(() => {
    if (!loading && atestados.length > 0 && !hasNotifiedDelay && profile) {
      const atrasados = atestados.filter(a => isOverdue(a));
      if (atrasados.length > 0) {
        toast.error(`Atenção: Você possui ${atrasados.length} atestado(s) pendente(s) de validação há mais de 3 dias!`, { duration: 8000 });
        toast.success(`Notificação (Push/Email) enviada para ${profile.email} com o alerta de atraso.`, { duration: 8000 });
      }
      setHasNotifiedDelay(true);
    }
  }, [loading, atestados, hasNotifiedDelay, profile]);

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  const handleOpenReminderModal = (atestado: any) => {
    setSelectedAtestado(atestado);
    setReminderMessage(
      `Olá ${atestado.colaboradorName},\n\nIdentificamos que o seu atestado emitido em ${atestado.dataEmissao} encontra-se com o status '${atestado.status.replace(/_/g, ' ')}' há mais de 3 dias.\n\nPor favor, verifique se há ações pendentes da sua parte para regularizar a situação ou entre em contato diretamente com o setor de Recursos Humanos.\n\nAtenciosamente,\nEquipe de RH`
    );
  };

  const confirmSendReminder = async () => {
    if (!selectedAtestado || !selectedAtestado.colaboradorUid) {
      toast.error('Colaborador não identificado.');
      return;
    }
    
    setIsSending(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', selectedAtestado.colaboradorUid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        await sendNotification({
          toEmail: userData.email,
          pushToken: userData.pushToken,
          subject: 'Lembrete de Atestado Pendente',
          message: reminderMessage
        });
        toast.success(`Lembrete enviado para ${userData.name}.`);
        setSelectedAtestado(null);
      } else {
        toast.error('Dados do colaborador não encontrados.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Falha ao enviar lembrete.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveNote = async (id: string, newNote: string, oldNote: string = '') => {
    if (newNote === oldNote) return;
    try {
      await updateDoc(doc(db, 'certificates', id), { rhNotes: newNote, updatedAt: serverTimestamp() });
      toast.success('Anotação salva.', { id: 'save-note' });
    } catch (error) {
      console.error('Erro ao salvar anotação:', error);
      toast.error('Erro ao salvar anotação.', { id: 'save-note' });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente_validacao': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400';
      case 'aceito': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400';
      case 'aceito_com_pendencia': return 'bg-lime-100 text-lime-800 dark:bg-lime-900/50 dark:text-lime-400';
      case 'rejeitado': return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400';
      case 'revisao_medica': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-400';
      case 'encaminhado_rh': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getMissingFields = (atestado: any) => {
    if (atestado.status !== 'pendente_validacao') return [];
    const missing = [];
    if (!atestado.cid?.trim()) missing.push('CID');
    if (!(atestado.nomeMedico || atestado.medicoNome)?.trim()) missing.push('Médico');
    if (!atestado.dataEmissao?.trim()) missing.push('Data de Emissão');
    if (atestado.quantidadeDias === null || atestado.quantidadeDias === undefined) missing.push('Dias de Afastamento');
    return missing;
  };

  const handleNotifyMissingFields = async (atestado: any) => {
    const missing = getMissingFields(atestado);
    if (missing.length === 0) return;
    
    setIsSending(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', atestado.colaboradorUid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        await sendNotification({
          toEmail: userData.email,
          pushToken: userData.pushToken,
          subject: 'Pendência no Atestado Médico',
          message: `Olá ${atestado.colaboradorName},\n\nO seu atestado enviado em ${atestado.dataEmissao || 'recente'} possui os seguintes campos ausentes ou ilegíveis:\n${missing.join(', ')}.\n\nPor favor, providencie um novo envio com a imagem nítida ou entre em contato com o RH da empresa.\n\nAtenciosamente,\nRecursos Humanos`
        });
        toast.success(`Notificação enviada para ${userData.name || userData.email}.`);
      } else {
        toast.error('Dados do colaborador não encontrados.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Falha ao enviar notificação.');
    } finally {
      setIsSending(false);
    }
  };

  const filteredAtestados = atestados.filter(a => {
    const query = searchQuery.toLowerCase();
    const nameMatch = a.colaboradorName?.toLowerCase().includes(query) ?? false;
    const statusMatch = a.status?.replace(/_/g, ' ').toLowerCase().includes(query) ?? false;
    const searchMatch = nameMatch || statusMatch;
    
    if (statusFilter !== 'all' && a.status !== statusFilter) {
      return false;
    }
    
    return searchMatch;
  });

  const handleExportCSV = () => {
    if (filteredAtestados.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }

    const headers = ['Colaborador', 'Data Emissão', 'Dias', 'CID', 'Status', 'Data Inserção Sistema'];
    const rows = filteredAtestados.map(a => [
      `"${a.colaboradorName || ''}"`,
      `"${a.dataEmissao || ''}"`,
      `"${a.quantidadeDias || ''}"`,
      `"${a.cid || ''}"`,
      `"${a.status ? a.status.replace(/_/g, ' ').toUpperCase() : ''}"`,
      `"${a.createdAt ? a.createdAt.toDate().toLocaleDateString() : ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    // Adiciona BOM (Byte Order Mark) para o excel reconhecer UTF-8 (Acentos) corretamente
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_absenteismo_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Arquivo CSV gerado com sucesso!');
  };

  const totalAtestados = atestados.length;
  const pendentes = atestados.filter(a => a.status === 'pendente_validacao' || a.status === 'encaminhado_rh').length;
  const diasPerdidos = atestados.reduce((acc, curr) => acc + (curr.quantidadeDias || 0), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gestão de RH</h2>
        <p className="text-gray-500 dark:text-gray-400">Visão geral de absenteísmo e atestados da empresa.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 flex items-center">
          <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 mr-4">
            <CertificateIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total de Atestados</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{totalAtestados}</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 flex items-center">
          <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-400 mr-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pendências RH</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{pendentes}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 flex items-center">
          <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 mr-4">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Dias Perdidos</p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{diasPerdidos}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 shadow-sm rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex flex-col items-start gap-4 lg:flex-row lg:items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Todos os Atestados</h3>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <select
                className="block w-full sm:w-48 pl-3 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-gray-100"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos os status</option>
                <option value="pendente_validacao">Pendente Validação</option>
                <option value="revisao_medica">Revisão Médica</option>
                <option value="encaminhado_rh">Encaminhado RH</option>
                <option value="aceito">Aceito</option>
                <option value="aceito_com_pendencia">Aceito com Pendência</option>
                <option value="rejeitado">Rejeitado</option>
              </select>
            </div>
            <div className="relative flex-1 sm:flex-none">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full md:w-80 pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 dark:text-gray-100"
                placeholder="Buscar por colaborador ou status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-slate-700 bg-slate-100 dark:bg-gray-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors"
              title="Exportar dados para Excel/CSV"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Colaborador</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data Emissão</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dias</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">CID</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-48">Anotações do RH</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-transparent divide-y divide-gray-200 dark:divide-gray-800">
              {filteredAtestados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nenhum atestado encontrado.
                  </td>
                </tr>
              ) : (
                filteredAtestados.map((atestado) => (
                  <tr key={atestado.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      <div className="flex items-center gap-2">
                        {atestado.colaboradorName}
                        {getMissingFields(atestado).length > 0 && (
                          <div className="group relative flex items-center justify-center">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            <div className="absolute inset-auto bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-max bg-gray-900 text-white text-xs rounded py-1 px-2 z-[60] shadow-lg">
                              <span className="font-semibold text-red-400">Campos pendentes:</span><br/>
                              {getMissingFields(atestado).join(', ')}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {atestado.dataEmissao || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {atestado.quantidadeDias || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {atestado.cid || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadge(atestado.status)}`}>
                        {atestado.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="text"
                        defaultValue={atestado.rhNotes || ''}
                        placeholder="Adicionar nota..."
                        className="block w-full text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:text-gray-100 px-3 py-1.5"
                        onBlur={(e) => handleSaveNote(atestado.id, e.target.value, atestado.rhNotes)}
                        onKeyDown={(e) => { 
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                        }}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {getMissingFields(atestado).length > 0 && (
                          <button 
                            onClick={() => handleNotifyMissingFields(atestado)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded-md hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors"
                            title="Notificar ausência de campos obrigatórios"
                          >
                            <Mail className="w-4 h-4" />
                            Notificar Pendência
                          </button>
                        )}
                        {isOverdue(atestado) && (
                          <button 
                            onClick={() => handleOpenReminderModal(atestado)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors"
                            title="Enviar lembrete (pendente há mais de 3 dias)"
                          >
                            <Bell className="w-4 h-4" />
                            Lembrar RH
                          </button>
                        )}
                        <button
                          onClick={() => setViewerAtestado(atestado)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                          title="Visualizar documento e detalhes"
                        >
                          <Eye className="w-4 h-4" />
                          Ver Doc
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Lembrete */}
      {selectedAtestado && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Enviar Lembrete
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Revise e personalize a mensagem antes de enviá-la para {selectedAtestado.colaboradorName}.
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mensagem
                </label>
                <textarea
                  rows={8}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={reminderMessage}
                  onChange={(e) => setReminderMessage(e.target.value)}
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedAtestado(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                disabled={isSending}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmSendReminder}
                disabled={isSending || !reminderMessage.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? 'Enviando...' : (
                  <>
                    <Bell className="w-4 h-4" />
                    Enviar Lembrete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
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
                    Atestado: {viewerAtestado.colaboradorName}
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
                
                {/* Status Banners */}
                <div className="flex flex-col gap-2">
                  <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                    ['aceito', 'aceito_com_pendencia'].includes(viewerAtestado.status) ? 'bg-green-50 border-green-200 text-green-800' : 
                    viewerAtestado.status === 'rejeitado' ? 'bg-red-50 border-red-200 text-red-800' :
                    viewerAtestado.status === 'revisao_medica' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                    'bg-indigo-50 border-indigo-200 text-indigo-800'
                  }`}>
                    <div className="mt-0.5">
                      {['aceito', 'aceito_com_pendencia'].includes(viewerAtestado.status) ? <CheckCircle className="w-5 h-5 text-green-600" /> : 
                       <AlertCircle className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold capitalize">{viewerAtestado.status.replace(/_/g, ' ')}</h4>
                      <p className="text-sm mt-1 opacity-90">
                        {viewerAtestado.status === 'revisao_medica' ? 'Atestado aguardando análise e liberação do Médico do Trabalho.' :
                         viewerAtestado.status === 'encaminhado_rh' ? 'Dados validados pela IA/Medicina. Aguardando aprovação final do RH na folha.' : 
                         'Documento em tramitação.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* AI Extracted Data */}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-gray-800 pb-2">
                    Dados Extraídos
                  </h4>
                  <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                    <div>
                      <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Nome do Paciente</span>
                      <span className="block mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{viewerAtestado.colaboradorName}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Médico Emissor</span>
                      <span className="block mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{viewerAtestado.medicoNome || 'Não lido'}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Data de Emissão</span>
                      <span className="block mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{viewerAtestado.dataEmissao}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Dias de Afastamento</span>
                      <span className="block mt-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400">{viewerAtestado.quantidadeDias} dias</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">CID (Doença)</span>
                      <span className="block mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{viewerAtestado.cid || 'Ausente'}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Tipo Documento</span>
                      <span className="block mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">{viewerAtestado.tipoDocumento}</span>
                    </div>
                  </div>
                </div>

                {/* POP Rules Log */}
                {viewerAtestado.popRegrasAplicadas && viewerAtestado.popRegrasAplicadas.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-gray-800 pb-2">
                       Trilha de Auditoria (Regras POP)
                    </h4>
                    <ul className="space-y-3">
                      {viewerAtestado.popRegrasAplicadas.map((rule: any, idx: number) => (
                        <li key={idx} className="flex gap-3 text-sm">
                          {rule.passed ? (
                            <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                          )}
                          <span className={rule.passed ? "text-gray-700 dark:text-gray-300" : "text-amber-700 dark:text-amber-400 font-medium"}>
                            {rule.message}
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
                      Parecer Médico / IA
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      {viewerAtestado.observacoesMedicas}
                    </p>
                  </div>
                )}

              </div>
            </div>
            
            {/* Footer Actions */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setViewerAtestado(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Fechar Janela
              </button>
              
              {/* Opções exclusivas do RH para finalizar o atestado */}
              {(viewerAtestado.status === 'pendente_validacao' || viewerAtestado.status === 'encaminhado_rh') && (profile?.role === 'rh' || profile?.role === 'admin' || profile?.role === 'superadmin') && (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      if(window.confirm('Tem certeza que deseja rejeitar este atestado no sistema da empresa?')) {
                        try {
                          await updateDoc(doc(db, 'certificates', viewerAtestado.id), { status: 'rejeitado', updatedAt: serverTimestamp() });
                          toast.success('Atestado rejeitado com sucesso.');
                          setViewerAtestado(null);
                        } catch (e) { toast.error('Erro ao rejeitar.'); }
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 transition-colors"
                  >
                    Rejeitar / Inválido
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'certificates', viewerAtestado.id), { status: 'aceito', updatedAt: serverTimestamp() });
                        toast.success('Atestado contabilizado na folha com sucesso!');
                        setViewerAtestado(null);
                      } catch (e) { toast.error('Erro ao aprovar.'); }
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Aceitar e Contabilizar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
