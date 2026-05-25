import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingDown, Activity, AlertCircle, FileText } from 'lucide-react';
import { format, subDays, startOfDay, parseISO } from 'date-fns';

export default function Analytics() {
  const { profile } = useAuth();
  const [atestados, setAtestados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || (profile.role !== 'rh' && profile.role !== 'admin' && profile.role !== 'superadmin')) return;

    let q;
    if (profile.role === 'superadmin') {
      q = query(collection(db, 'certificates'));
    } else {
      q = query(collection(db, 'certificates'), where('companyId', '==', profile.companyId || 'DEFAULT_COMPANY'));
    }

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

  const {
    kpis,
    chartDataStatus,
    chartDataCid,
    chartDataTimeline
  } = useMemo(() => {
    if (!atestados.length) {
      return { kpis: { total: 0, dias: 0, mediaDias: 0 }, chartDataStatus: [], chartDataCid: [], chartDataTimeline: [] };
    }

    // KPIs
    const total = atestados.length;
    const dias = atestados.reduce((acc, curr) => acc + (Number(curr.quantidadeDias) || 0), 0);
    const mediaDias = total > 0 ? (dias / total).toFixed(1) : 0;

    // Status Distribution
    const statusCount = atestados.reduce((acc, curr) => {
      const s = curr.status || 'desconhecido';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const chartDataStatus = Object.keys(statusCount).map(key => ({
      name: key.replace(/_/g, ' ').toUpperCase(),
      value: statusCount[key]
    }));

    // Top CIDs
    const cidCount = atestados.reduce((acc, curr) => {
      if (curr.cid) {
        const c = curr.cid.toUpperCase();
        acc[c] = (acc[c] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const chartDataCid = Object.keys(cidCount)
      .map(key => ({ name: key, count: cidCount[key] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // top 5

    // Timeline (last 30 days)
    const timelineDict: Record<string, number> = {};
    const today = startOfDay(new Date());
    
    // Initialize last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(today, i), 'dd/MM');
      timelineDict[d] = 0;
    }

    atestados.forEach(a => {
      // Use createdAt
      if (a.createdAt) {
        const d = format(a.createdAt.toDate(), 'dd/MM');
        if (timelineDict[d] !== undefined) {
          timelineDict[d] += 1;
        }
      }
    });

    const chartDataTimeline = Object.keys(timelineDict).map(k => ({
      date: k,
      Atestados: timelineDict[k]
    }));

    return {
      kpis: { total, dias, mediaDias },
      chartDataStatus,
      chartDataCid,
      chartDataTimeline
    };
  }, [atestados]);

  if (loading) {
    return <div className="flex justify-center p-8">Carregando métricas...</div>;
  }

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Activity className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          Analytics & Saúde Ocupacional
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Visão estratégica do absenteísmo e performance de saúde da empresa.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total de Atestados</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{kpis.total}</h3>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <FileText className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Dias de Trabalho Perdidos</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{kpis.dias}</h3>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-lg">
              <TrendingDown className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Média de Dias p/ Atestado</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{kpis.mediaDias}</h3>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline Chart */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">Volume de Entrada (Últimos 30 dias)</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartDataTimeline} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                <XAxis dataKey="date" tick={{fontSize: 12}} tickMargin={10} stroke="#6b7280" />
                <YAxis allowDecimals={false} tick={{fontSize: 12}} stroke="#6b7280" />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f9fafb', borderRadius: '0.375rem' }} 
                  itemStyle={{ color: '#818cf8' }}
                />
                <Line type="monotone" dataKey="Atestados" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top CIDs Chart */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">Top 5 CID (Causas Raiz)</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataCid} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#374151" opacity={0.2} />
                <XAxis type="number" allowDecimals={false} stroke="#6b7280" />
                <YAxis dataKey="name" type="category" tick={{fontSize: 12, fill: '#6b7280'}} width={80} />
                <RechartsTooltip 
                  cursor={{fill: 'rgba(107, 114, 128, 0.1)'}}
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f9fafb', borderRadius: '0.375rem' }} 
                />
                <Bar dataKey="count" fill="#4f46e5" radius={[0, 4, 4, 0]}>
                  {chartDataCid.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">Distribuição por Status</h3>
          <div className="h-72 w-full flex items-center justify-center">
            {chartDataStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartDataStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartDataStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f9fafb', borderRadius: '0.375rem' }} 
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500">Nenhum dado disponível.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
