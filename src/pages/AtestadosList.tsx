import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Clock, AlertCircle, CheckCircle, FileBadge, X, Printer, Calendar as CalendarIcon, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { CertificateIcon } from '../components/CertificateIcon';
import { format, addDays, startOfMonth, startOfWeek, endOfWeek, endOfMonth, isSameMonth, addMonths, subMonths, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AtestadosList() {
  const { profile } = useAuth();
  const [atestados, setAtestados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [selectedDetails, setSelectedDetails] = useState<any>(null);
  
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'certificates'),
      where('colaboradorUid', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAtestados(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'certificates');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'aceito': return <CheckCircle className="w-5 h-5 text-green-500 dark:text-green-400" />;
      case 'pendente_validacao': return <Clock className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />;
      case 'revisao_medica': return <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400" />;
      default: return <CertificateIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    return status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Desconhecido';
  };

  const parseDateStr = (dateStr: string) => {
    if (!dateStr) return new Date();
    if (dateStr.includes('/')) {
      const [d, m, y] = dateStr.split('/');
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  // Convert atestados for calendar
  const certsWithPeriods = atestados.map(a => {
    const startStr = a.dataInicioAfastamento || a.dataEmissao;
    const start = parseDateStr(startStr);
    const end = addDays(start, Math.max((a.quantidadeDias || 1) - 1, 0));
    return { ...a, periodStart: start, periodEnd: end };
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, 'd');
        const cloneDay = day;

        // Check if this day is within any atestado period
        const certOnDay = certsWithPeriods.find(c => {
          // Setting the intervals to start of day to ensure logic works perfectly independent of time extraction
          const checkDate = new Date(cloneDay.setHours(0,0,0,0));
          const s = new Date(c.periodStart.setHours(0,0,0,0));
          const e = new Date(c.periodEnd.setHours(23,59,59,999));
          return checkDate >= s && checkDate <= e;
        });

        days.push(
          <div
            className={`p-2 min-h-[90px] border-b border-r border-gray-200 dark:border-gray-800 ${
              !isSameMonth(day, monthStart)
                ? "bg-gray-50 text-gray-400 dark:bg-gray-900/50 dark:text-gray-600"
                : "bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100"
            }`}
            key={day.toString()}
          >
            <span className="text-sm font-medium">{formattedDate}</span>
            {certOnDay && (
              <div 
                className={`mt-1 p-1 px-2 text-xs font-semibold rounded text-white truncate cursor-pointer transition-transform hover:scale-105 ${
                  certOnDay.status === 'aceito' ? 'bg-emerald-500' : 
                  certOnDay.status === 'rejeitado' ? 'bg-red-500' : 
                  'bg-amber-500'
                }`} 
                title={`Atestado: CID ${certOnDay.cid || 'N/A'}`}
                onClick={() => setSelectedDetails(certOnDay)}
              >
                {certOnDay.quantidadeDias} dia(s)
              </div>
            )}
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }

    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4">
        <div className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <button onClick={prevMonth} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-bold text-gray-800 dark:text-gray-100 capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 divide-x divide-gray-200 dark:divide-gray-800 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          {dayNames.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>
        <div className="flex flex-col divide-y divide-gray-200 dark:divide-gray-800">
          {rows}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Meus Atestados</h2>
          <p className="text-gray-500 dark:text-gray-400">Histórico de atestados enviados e visualização de afastamentos.</p>
        </div>
        
        {/* Toggle Controls */}
        <div className="flex items-center p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
              viewMode === 'list' 
                ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <List className="w-4 h-4" />
            Lista
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
              viewMode === 'calendar' 
                ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            Calendário
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="bg-white dark:bg-gray-900 shadow-sm rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data Emissão</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dias</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Médico</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">CRM</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">CID</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-transparent divide-y divide-gray-200 dark:divide-gray-800">
            {atestados.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  Nenhum atestado encontrado.
                </td>
              </tr>
            ) : (
              atestados.map((atestado) => (
                <tr key={atestado.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {atestado.dataEmissao || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {atestado.quantidadeDias || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {atestado.nomeMedico || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {atestado.crmMedico || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {atestado.cid || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(atestado.status)}
                      <span className="text-sm text-gray-700 dark:text-gray-300">{getStatusText(atestado.status)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                      onClick={() => setSelectedDetails(atestado)}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 mr-4"
                    >
                      Ver Detalhes
                    </button>
                    {(atestado.status === 'aceito' || atestado.status === 'aceito_com_pendencia') && (
                      <button 
                        onClick={() => setSelectedReceipt(atestado)}
                        className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                        title="Baixar Comprovante de Validação"
                      >
                        <FileBadge className="w-4 h-4" />
                        Comprovante
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      ) : (
        renderCalendar()
      )}

      {/* Modal Detalhes do Atestado */}
      {selectedDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <FileBadge className="w-6 h-6 text-indigo-500" />
                Detalhes do Atestado
              </h3>
              <button 
                onClick={() => setSelectedDetails(null)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Status Section */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                {getStatusIcon(selectedDetails.status)}
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Status Atual</p>
                  <p className="font-semibold text-gray-900 dark:text-white capitalize">{getStatusText(selectedDetails.status)}</p>
                </div>
              </div>

              {/* Informações Principais */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3">Informações Principais</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Data de Emissão</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{selectedDetails.dataEmissao || '-'}</span>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Dias de Afastamento</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{selectedDetails.quantidadeDias || '-'}</span>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Médico</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{selectedDetails.nomeMedico || selectedDetails.medicoNome || '-'}</span>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">CRM</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{selectedDetails.crmMedico || '-'}</span>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">CID</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{selectedDetails.cid || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Anotações do RH */}
              {selectedDetails.rhNotes && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-indigo-500" />
                    Anotações do RH
                  </h4>
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800/30 text-indigo-900 dark:text-indigo-200 text-sm whitespace-pre-wrap">
                    {selectedDetails.rhNotes}
                  </div>
                </div>
              )}

              {/* Histórico de Status */}
              {(selectedDetails.statusHistory && Array.isArray(selectedDetails.statusHistory) && selectedDetails.statusHistory.length > 0) && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    Histórico de Atualizações
                  </h4>
                  <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 dark:before:via-gray-700 before:to-transparent">
                    {selectedDetails.statusHistory.map((historyItem: any, index: number) => (
                      <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full border border-white dark:border-gray-900 bg-indigo-500 text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow absolute left-0 md:left-1/2 -translate-x-1/2"></div>
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow flex-1 ml-6 md:ml-0 md:w-[calc(50%-1.5rem)]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-gray-900 dark:text-white capitalize text-sm">{getStatusText(historyItem.status)}</span>
                            <time className="text-xs text-gray-500 dark:text-gray-400">
                              {historyItem.timestamp?.toDate ? format(historyItem.timestamp.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                            </time>
                          </div>
                          {historyItem.note && (
                            <p className="text-gray-600 dark:text-gray-300 text-xs mt-1">{historyItem.note}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
              <button
                onClick={() => setSelectedDetails(null)}
                className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Recibo de Validação */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden relative">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <button 
                onClick={() => window.print()}
                className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 p-2 rounded-full transition-colors"
                title="Imprimir / Salvar PDF"
              >
                <Printer className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setSelectedReceipt(null)}
                className="bg-gray-100 text-gray-500 hover:bg-gray-200 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div id="printable-receipt" className="p-10 bg-white text-gray-900">
              {/* Receipt Header */}
              <div className="flex items-center justify-between border-b-2 border-gray-100 pb-6 mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-600 p-2 rounded-lg">
                    <CertificateIcon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">MedControl</h2>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">Global Health Tech</p>
                  </div>
                </div>
                <div className="text-right">
                  <h3 className="text-lg font-bold text-gray-800 uppercase tracking-widest">Laudo de Validação</h3>
                  <p className="text-sm text-gray-500 font-mono mt-1">
                    ID: {btoa(selectedReceipt.id).substring(0, 12).toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Receipt Body */}
              <div className="space-y-6">
                <p className="text-gray-700 leading-relaxed text-justify">
                  Certificamos para os devidos fins legais e trabalhistas que o atestado médico abaixo discriminado, emitido em favor do colaborador <strong>{selectedReceipt.colaboradorName}</strong>, foi recepcionado e <strong>VALIDADO</strong> com sucesso pelo departamento de Medicina Ocupacional.
                </p>

                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-6 rounded-lg border border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Data da Emissão</p>
                    <p className="text-lg font-medium text-gray-900">{selectedReceipt.dataEmissao || 'N/D'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Período de Afastamento</p>
                    <p className="text-lg font-medium text-gray-900 animate-pulse-text">{selectedReceipt.quantidadeDias || '0'} dias</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Código CID</p>
                    <p className="text-lg font-medium text-gray-900">{selectedReceipt.cid || 'NÃO INFORMADO'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Médico Emissor</p>
                    <p className="text-lg font-medium text-gray-900 truncate" title={selectedReceipt.medicoEmissor}>
                      {selectedReceipt.medicoEmissor || 'CRM Validado'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-8 mt-8 border-t border-gray-100">
                  <div className="flex flex-col items-center">
                    <div className="h-16 flex items-end justify-center mb-1">
                      <span className="text-4xl text-indigo-900 opacity-80" style={{ fontFamily: '"Brush Script MT", "Caveat", "Handlee", cursive', transform: 'rotate(-5deg)' }}>
                         {selectedReceipt.medicoValidadorNome || 'Sistema Inteligente'}
                      </span>
                    </div>
                    <div className="w-48 border-t border-gray-400"></div>
                    <p className="text-xs text-gray-600 mt-2 font-medium">Assinatura do Validador</p>
                  </div>
                  
                  <div className="text-center bg-emerald-50 px-6 py-4 rounded-lg border border-emerald-100">
                    <div className="flex justify-center mb-2">
                       <CheckCircle className="w-8 h-8 text-emerald-500" />
                    </div>
                    <p className="text-sm font-bold text-emerald-700 uppercase tracking-wider">Atestado Aceito</p>
                    <p className="text-xs text-emerald-600 mt-1">Abono Autorizado</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 text-center text-[10px] text-gray-400 font-mono">
                Autenticidade digital gerada em {new Date().toLocaleString('pt-BR')} sob protocolo e-Social #{new Date().getTime().toString().substring(5)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
