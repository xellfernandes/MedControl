import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, doc, setDoc, serverTimestamp, getDocs, where, updateDoc } from 'firebase/firestore';
import { Building, Plus, MoreVertical, X, UserPlus, Download } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SuperAdminCompanies() {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyId, setNewCompanyId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedCompanyToInvite, setSelectedCompanyToInvite] = useState<any>(null);
  const [inviteEmail, setInviteEmail] = useState('');

  useEffect(() => {
    if (!profile || profile.role !== 'superadmin') return;

    const q = query(
      collection(db, 'companies'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCompanies(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'companies');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleExportCSV = () => {
    if (companies.length === 0) {
      toast.error('Nenhuma empresa para exportar.');
      return;
    }

    const headers = ['Nome,ID,Status,Data de Ingresso'];
    const csvContent = companies.map(company => {
      const name = `"${company.name || ''}"`;
      const id = `"${company.id || ''}"`;
      const status = `"${company.active ? 'Ativa' : 'Inativa'}"`;
      const date = `"${company.createdAt?.toDate().toLocaleDateString('pt-BR') || ''}"`;
      return `${name},${id},${status},${date}`;
    });

    const blob = new Blob([headers.concat(csvContent).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `empresas_medcontrol_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!profile || profile.role !== 'superadmin') {
    return <div className="p-8 text-center text-red-500">Acesso Restrito.</div>;
  }

  if (loading) {
    return <div className="flex justify-center p-8">Carregando empresas...</div>;
  }

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim() || !newCompanyId.trim()) {
      toast.error('Preencha os campos (Nome e ID)');
      return;
    }

    const slugifiedId = newCompanyId.toLowerCase().replace(/[^a-z0-9_-]/g, "");

    setIsSubmitting(true);
    try {
      const docRef = doc(db, 'companies', slugifiedId);
      await setDoc(docRef, {
        name: newCompanyName,
        active: true,
        createdAt: serverTimestamp(),
      });
      toast.success('Empresa registrada com sucesso!');
      setIsModalOpen(false);
      setNewCompanyName('');
      setNewCompanyId('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'companies');
      toast.error('Falha ao criar empresa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInviteRH = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !selectedCompanyToInvite) return;
    
    setIsSubmitting(true);
    try {
      const q = query(collection(db, 'users'), where('email', '==', inviteEmail.trim().toLowerCase()));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const userDoc = snap.docs[0];
        await updateDoc(doc(db, 'users', userDoc.id), {
          companyId: selectedCompanyToInvite.id,
          role: 'rh'
        });
        toast.success(`Usuário vinculado e promovido a RH da empresa ${selectedCompanyToInvite.name}!`);
      } else {
        await setDoc(doc(db, 'invites', inviteEmail.trim().toLowerCase()), {
          companyId: selectedCompanyToInvite.id,
          role: 'rh',
          createdAt: serverTimestamp()
        });
        toast.success('Usuário não encontado na base. Lançado um CONVITE PENDENTE de RH para quando ele se registrar!');
      }
      setIsInviteModalOpen(false);
      setInviteEmail('');
      setSelectedCompanyToInvite(null);
    } catch (error) {
      toast.error('Erro ao processar a vinculação do RH.');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Building className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Empresas (SaaS)
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Gerencie os clientes (tenants) da plataforma MedControl.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Empresa
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 shadow-sm rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Empresa</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Company ID</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data de Ingresso</th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-transparent divide-y divide-gray-200 dark:divide-gray-800">
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                    Nenhuma empresa encontrada além do padrão.
                  </td>
                </tr>
              ) : (
                companies.map((company) => (
                  <tr key={company.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{company.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300">
                        {company.id}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${company.active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {company.active ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {company.createdAt?.toDate().toLocaleDateString('pt-BR') || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => {
                          setSelectedCompanyToInvite(company);
                          setIsInviteModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                        title="Vincular Gestor de RH à esta empresa"
                      >
                        <UserPlus className="w-4 h-4" />
                        Vincular RH
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal - Nova Empresa */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Cadastrar Empresa
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateCompany}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nome da Empresa
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Ex: Acme Corp"
                    value={newCompanyName}
                    onChange={(e) => {
                      setNewCompanyName(e.target.value);
                      if (!newCompanyId) {
                        setNewCompanyId(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ID da Empresa (Identificador Único)
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="ex: acme-corp"
                    value={newCompanyId}
                    onChange={(e) => setNewCompanyId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  />
                  <p className="text-xs text-gray-500 mt-1">Este ID será usado nos convites para os funcionários desta empresa.</p>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newCompanyName || !newCompanyId}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Salvando...' : 'Criar Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Vincular RH */}
      {isInviteModalOpen && selectedCompanyToInvite && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Vincular RH
              </h3>
              <button 
                onClick={() => setIsInviteModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleInviteRH}>
              <div className="p-6 space-y-4">
                <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800/50">
                  <p className="text-sm font-medium text-indigo-800 dark:text-indigo-300">Empresa de destino:</p>
                  <p className="text-lg font-bold text-indigo-900 dark:text-indigo-200">{selectedCompanyToInvite.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    E-mail do Gestor (Google Login)
                  </label>
                  <input
                    type="email"
                    required
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="E-mail que o RH usará para logar no sistema..."
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Se o usuário já existe na base, ele será movido para essa empresa imediatamente. 
                    Se não existe, o sistema guardará a permissão para quando ele fizer o primeiro login Google!
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !inviteEmail}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Processando...' : 'Confirmar Vínculo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
