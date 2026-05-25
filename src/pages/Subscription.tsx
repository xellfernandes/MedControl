import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Check, Zap, Building, CreditCard, ShieldCheck } from 'lucide-react';

export default function Subscription() {
  const { profile } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSubscribe = (planName: string) => {
    setLoadingPlan(planName);
    // Simulação do redirect para o Stripe Checkout
    setTimeout(() => {
      alert(`Redirecionando para o Checkout (Stripe) do plano: ${planName}...\n\n(No ambiente de produção, esta ação abre o link seguro de pagamento da Stripe)`);
      setLoadingPlan(null);
    }, 1500);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
          Planos e Assinaturas
        </h2>
        <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">
          Você está atualmente no plano gratuito. Faça um upgrade para destravar todo o poder da inteligência artificial e analytics de RH na sua empresa.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
        
        {/* Starter Plan */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 flex flex-col">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Starter</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Para experimentar a validação digital.</p>
          </div>
          <div className="mb-6 flex items-baseline text-gray-900 dark:text-white">
            <span className="text-4xl font-extrabold tracking-tight">R$ 0</span>
            <span className="ml-1 text-xl font-semibold text-gray-500 dark:text-gray-400">/mês</span>
          </div>
          <ul className="flex-1 space-y-4 mb-8">
            <li className="flex items-start">
              <Check className="h-5 w-5 text-indigo-500 shrink-0 mr-2" />
              <span className="text-gray-600 dark:text-gray-300">Até 10 envios de atestados/mês</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-indigo-500 shrink-0 mr-2" />
              <span className="text-gray-600 dark:text-gray-300">Painel de listagem básico</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-indigo-500 shrink-0 mr-2" />
              <span className="text-gray-600 dark:text-gray-300">Aceitação manual via RH</span>
            </li>
          </ul>
          <button 
            disabled 
            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-semibold py-3 px-4 rounded-xl cursor-not-allowed"
          >
            Plano Atual
          </button>
        </div>

        {/* Pro Plan */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border-2 border-indigo-500 p-8 flex flex-col relative transform scale-105 z-10">
          <div className="absolute top-0 right-6 transform -translate-y-1/2">
             <span className="bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full">
               Mais Popular
             </span>
          </div>
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold text-indigo-600 dark:text-indigo-400">Pro</h3>
              <Zap className="h-5 w-5 text-indigo-500 fill-indigo-500" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Automação total para o seu RH.</p>
          </div>
          <div className="mb-6 flex items-baseline text-gray-900 dark:text-white">
            <span className="text-4xl font-extrabold tracking-tight">R$ 399</span>
            <span className="ml-1 text-xl font-semibold text-gray-500 dark:text-gray-400">/mês</span>
          </div>
          <ul className="flex-1 space-y-4 mb-8">
            <li className="flex items-start">
              <Check className="h-5 w-5 text-indigo-500 shrink-0 mr-2" />
              <span className="text-gray-600 dark:text-gray-300 font-medium">Até 200 colaboradores ativos</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-indigo-500 shrink-0 mr-2" />
              <span className="text-gray-600 dark:text-gray-300 text-sm">Leitura OCR e IA Ilimitada</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-indigo-500 shrink-0 mr-2" />
              <span className="text-gray-600 dark:text-gray-300 text-sm">Verificador de CFM/CRM integrado</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-indigo-500 shrink-0 mr-2" />
              <span className="text-gray-600 dark:text-gray-300 text-sm">Módulo Analytics & Gráficos</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-indigo-500 shrink-0 mr-2" />
              <span className="text-gray-600 dark:text-gray-300 text-sm">Laudo / Comprovante PDF Digital</span>
            </li>
          </ul>
          <button 
            onClick={() => handleSubscribe('Pro')}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            {loadingPlan === 'Pro' ? (
              <span className="animate-pulse">Gerando Checkout...</span>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                Assinar Plano Pro
              </>
            )}
          </button>
        </div>

        {/* Enterprise Plan */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 flex flex-col">
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Enterprise</h3>
              <Building className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Para médias e grandes corporações.</p>
          </div>
          <div className="mb-6 flex items-baseline text-gray-900 dark:text-white">
            <span className="text-4xl font-extrabold tracking-tight">Pers.</span>
          </div>
          <ul className="flex-1 space-y-4 mb-8">
            <li className="flex items-start">
              <Check className="h-5 w-5 text-indigo-500 shrink-0 mr-2" />
              <span className="text-gray-600 dark:text-gray-300 text-sm">Mais de 500 colaboradores</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-indigo-500 shrink-0 mr-2" />
              <span className="text-gray-600 dark:text-gray-300 text-sm">Tudo do PRO liberado</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-indigo-500 shrink-0 mr-2" />
              <span className="text-gray-600 dark:text-gray-300 text-sm">Integração via API com ERP (Sênior, TOTVS, SAP)</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-indigo-500 shrink-0 mr-2" />
              <span className="text-gray-600 dark:text-gray-300 text-sm">Suporte Dedicado (SLA 4h)</span>
            </li>
          </ul>
          <button 
            onClick={() => handleSubscribe('Enterprise')}
            className="w-full bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            Falar com Consultor
          </button>
        </div>

      </div>

      <div className="mt-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-6 md:p-8 flex items-start gap-4 border border-emerald-100 dark:border-emerald-900/30">
        <div className="bg-emerald-100 dark:bg-emerald-800 p-3 rounded-full shrink-0">
          <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Pagamento Seguro & Faturamento Flexível</h4>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            A MedControl utiliza a infraestrutura global da Stripe para processamento. Emita boletos, pague via PIX recorrente ou cadastre o cartão corporativo. O Portal do Assinante permite alteração de limite e downgrade a qualquer momento, sem taxas de cancelamento.
          </p>
        </div>
      </div>
    </div>
  );
}
