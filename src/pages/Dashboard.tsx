import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { Clock, AlertTriangle, CheckCircle, Zap, TrendingUp, HandCoins, ArrowRight, Activity, BarChart2, Download } from 'lucide-react';
import { CertificateIcon } from '../components/CertificateIcon';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend } from 'recharts';
import { format, subDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function Dashboard() {
  const { profile } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState({
    total: 0,
    pendentes: 0,
    revisao: 0,
    aceitos: 0,
    rejeitados: 0
  });
  const [recentes, setRecentes] = useState<any[]>([]);
  const [allAtestados, setAllAtestados] = useState<any[]>([]);
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

  useEffect(() => {
    if (!profile) return;

    let q;
    if (profile.role === 'colaborador') {
      q = query(collection(db, 'certificates'), where('colaboradorUid', '==', profile.uid));
    } else if (profile.role === 'superadmin') {
      q = query(collection(db, 'certificates'));
    } else {
      q = query(collection(db, 'certificates'), where('companyId', '==', profile.companyId || 'DEFAULT_COMPANY'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let total = 0;
      let pendentes = 0;
      let revisao = 0;
      let aceitos = 0;
      let rejeitados = 0;

      snapshot.docs.forEach(doc => {
        total++;
        const status = doc.data().status;
        if (status === 'pendente_validacao' || status === 'pendente_ocr') pendentes++;
        if (status === 'revisao_medica') revisao++;
        if (status === 'aceito' || status === 'aceito_com_pendencia') aceitos++;
        if (status === 'rejeitado') rejeitados++;
      });

      setStats({ total, pendentes, revisao, aceitos, rejeitados });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'certificates');
    });

    // Fetch recent activity
    let qRecent;
    if (profile.role === 'colaborador') {
      qRecent = query(collection(db, 'certificates'), where('colaboradorUid', '==', profile.uid));
    } else if (profile.role === 'superadmin') {
      qRecent = query(collection(db, 'certificates'));
    } else {
      qRecent = query(collection(db, 'certificates'), where('companyId', '==', profile.companyId || 'DEFAULT_COMPANY'));
    }

    const unsubscribeRecent = onSnapshot(qRecent, (snapshot) => {
      let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toMillis?.() || 0;
        const dateB = b.createdAt?.toMillis?.() || 0;
        return dateB - dateA;
      });
      setAllAtestados(docs);
      setRecentes(docs.slice(0, 5));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'certificates');
    });

    return () => {
      unsubscribe();
      unsubscribeRecent();
    };
  }, [profile]);

  // Cálculos de ROI baseados nos atestados processados
  // Assumimos que o RH leva em média 6 minutos = 0.1 hora para ler e imputar dados manualmente
  const hoursSaved = (stats.total * 6) / 60; 
  // Custo médio de R$ 50/h de um profissional
  const moneySaved = hoursSaved * 50; 

  // Process data for charts
  const last14Days = Array.from({ length: 14 }).map((_, i) => subDays(new Date(), 13 - i));
  
  const trendData = last14Days.map(date => {
    const dayCerts = allAtestados.filter(a => {
      const d = a.createdAt?.toDate() || new Date();
      return isSameDay(d, date);
    });
    
    const absenteismo = dayCerts.reduce((acc, curr) => acc + (parseInt(curr.quantidadeDias) || 1), 0);
    
    return {
      name: format(date, 'dd/MM'),
      'Dias Afastados': absenteismo
    };
  });

  const cidCounts: Record<string, number> = {};
  allAtestados.forEach(a => {
    const cid = a.cid?.trim().toUpperCase() || 'Sem CID';
    cidCounts[cid] = (cidCounts[cid] || 0) + 1;
  });
  
  const cidData = Object.entries(cidCounts)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  const COLORS = ['#4f46e5', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#64748b'];

  // Status Distribution Data
  const pieData = [
    { name: 'Aprovados', value: stats.aceitos, color: '#10b981' }, // emarald
    { name: 'Rejeitados', value: stats.rejeitados, color: '#f43f5e' }, // rose
    { name: 'Revisão Médica', value: stats.revisao, color: '#f59e0b' }, // amber
    { name: 'Pendentes / Triagem', value: stats.pendentes, color: '#6366f1' }, // indigo
  ].filter(d => d.value > 0);

  // Progress Bar Data
  const processados = stats.aceitos + stats.rejeitados;
  const targetProcessamento = stats.total;
  const progressPercent = targetProcessamento > 0 ? Math.round((processados / targetProcessamento) * 100) : 0;

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2, // High resolution
        useCORS: true,
        logging: false,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#111827' : '#ffffff'
      });
      
      const imgWidth = 210; // A4 size in mm
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      const doc = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      
      let position = 0;
      doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        doc.addPage();
        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      doc.save(`Relatorio_MedControl_${format(new Date(), 'dd_MM_yyyy')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Olá, {profile?.name}</h2>
          <p className="text-gray-500 dark:text-gray-400">Bem-vindo ao sistema de gestão de atestados.</p>
        </div>
        
        <button 
          onClick={handleExportPDF}
          disabled={isExporting}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-md shadow-sm transition-colors"
        >
          <Download className="w-4 h-4" />
          {isExporting ? 'Gerando PDF...' : 'Exportar Relatório'}
        </button>
      </div>

      <div ref={reportRef} className="space-y-6 p-2 bg-gray-50 dark:bg-gray-950">
        {/* ROI & AI Automation Widget */}
        {(profile?.role === 'rh' || profile?.role === 'superadmin' || profile?.role === 'admin') && (
          <div className="relative overflow-hidden bg-indigo-600 rounded-2xl shadow-lg border border-indigo-500 p-6 sm:p-8 text-white">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-indigo-500 rounded-full opacity-50 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-24 h-24 bg-indigo-700 rounded-full opacity-50 blur-xl"></div>
          
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Zap className="w-6 h-6 text-yellow-300 fill-yellow-300" />
                  Economia e Automação via IA
                </h3>
                <p className="text-indigo-200 mt-1 max-w-xl text-sm sm:text-base">
                  {companyPlan === 'starter' 
                    ? "Veja o tempo e dinheiro que seu RH poderia estar poupando se a Inteligência Artificial estivesse lendo todos esses atestados automaticamente."
                    : "Resultados diretos da automação da leitura de atestados operando na sua empresa."}
                </p>
              </div>
              
              {companyPlan === 'starter' && (
                <Link to="/meu-plano" className="inline-flex items-center gap-2 bg-white text-indigo-700 hover:bg-indigo-50 px-4 py-2 rounded-lg font-semibold text-sm transition-colors whitespace-nowrap">
                  Liberar Plano PRO <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
              <div className="bg-indigo-700/50 rounded-xl p-4 border border-indigo-500/50 backdrop-blur-sm relative overflow-hidden group">
                {companyPlan === 'starter' && (
                  <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-200 bg-gray-900/80 px-3 py-1 rounded-full border border-gray-700 shadow-xl">Conteúdo Bloqueado</span>
                  </div>
                )}
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-indigo-500/30 rounded-lg">
                    <Clock className="w-5 h-5 text-indigo-100" />
                  </div>
                  <span className="text-indigo-100 font-medium">Tempo Operacional Salvo</span>
                </div>
                <div className="text-3xl font-extrabold">{hoursSaved.toFixed(1)} <span className="text-lg font-normal text-indigo-200">horas</span></div>
              </div>

              <div className="bg-indigo-700/50 rounded-xl p-4 border border-indigo-500/50 backdrop-blur-sm relative overflow-hidden group">
                {companyPlan === 'starter' && (
                  <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-green-200 bg-gray-900/80 px-3 py-1 rounded-full border border-gray-700 shadow-xl">Conteúdo Bloqueado</span>
                  </div>
                )}
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-indigo-500/30 rounded-lg">
                    <HandCoins className="w-5 h-5 text-green-300" />
                  </div>
                  <span className="text-indigo-100 font-medium">Redução de Custo (ROI)</span>
                </div>
                <div className="text-3xl font-extrabold text-green-300"><span className="text-lg font-normal text-green-300/70 mr-1">R$</span>{moneySaved.toFixed(2).replace('.', ',')}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total de Atestados" 
          value={stats.total.toString()} 
          icon={CertificateIcon} 
          color="bg-blue-500" 
        />
        <StatCard 
          title="Pendentes" 
          value={stats.pendentes.toString()} 
          icon={Clock} 
          color="bg-yellow-500" 
        />
        <StatCard 
          title="Revisão Médica" 
          value={stats.revisao.toString()} 
          icon={AlertTriangle} 
          color="bg-red-500" 
        />
        <StatCard 
          title="Aceitos" 
          value={stats.aceitos.toString()} 
          icon={CheckCircle} 
          color="bg-green-500" 
        />
      </div>

      {/* Gráficos Interativos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Tendência de Absenteísmo (14 dias)</h3>
            </div>
            <button
              onClick={() => {
                if (chartRef.current) {
                  html2canvas(chartRef.current, {
                    backgroundColor: document.documentElement.classList.contains('dark') ? '#111827' : '#ffffff'
                  }).then(canvas => {
                    const link = document.createElement('a');
                    link.download = `Tendencia_Absenteismo_${format(new Date(), 'dd_MM_yyyy')}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                  });
                }
              }}
              className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Exportar Gráfico (.png)"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
          <div className="h-72" ref={chartRef}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAbsenteismo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} stroke="#9ca3af" allowDecimals={false} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="Dias Afastados" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorAbsenteismo)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart2 className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Distribuição de CIDs Frequentes</h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cidData} layout="vertical" margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} stroke="#9ca3af" allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fontWeight: 500 }} tickLine={false} axisLine={false} stroke="#4B5563" width={60} />
                <RechartsTooltip 
                  cursor={{fill: 'transparent'}}
                  contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${value} atestados`, 'Quantidade']}
                />
                <Bar dataKey="value" name="Quantidade" radius={[0, 4, 4, 0]} barSize={25}>
                  {cidData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress & Distribution Widget */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6 flex flex-col">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">Auditoria Geral</h3>
          
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Auditorias Concluídas</span>
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{progressPercent}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {processados} de {targetProcessamento} documentos processados
            </p>
          </div>

          {/* Donut Chart */}
          <div className="flex-1 min-h-[220px]">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                Sem dados para exibir
              </div>
            )}
          </div>
        </div>

        {/* Atividade Recente Widget */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Atividade Recente</h3>
          {recentes.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400 text-sm">
              Nenhuma atividade recente encontrada.
            </div>
          ) : (
            <div className="space-y-4">
              {recentes.map(item => (
                <div key={item.id} className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.colaboradorName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Enviado em {item.createdAt?.toDate().toLocaleDateString()}</p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                    {item.status.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string, value: string, icon: any, color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6 flex items-center">
      <div className={`p-3 rounded-full ${color} text-white mr-4`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      </div>
    </div>
  );
}
