import React from 'react';
import { Database, ShieldCheck, Loader2 } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';

interface HeaderProps {
  activeTab: 'revisao' | 'mp' | 'cif' | 'param';
  setActiveTab: (tab: 'revisao' | 'mp' | 'cif' | 'param') => void;
  fonte: 'supabase' | 'local';
  isSyncing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  fonte,
  isSyncing
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#D2E0E0] shadow-sm">
      <div className="max-w-[1120px] mx-auto px-5 pt-3.5 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-[38px] h-[38px] rounded-[10px] bg-[#0B6E78] flex items-center justify-center text-white shadow-sm flex-none">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M3 14c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 3 2"/>
                <path d="M3 18.5c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 3 2"/>
                <path d="M8 9.5C8 6.5 10 4.5 13 4.5c2.2 0 3.6 1.1 4.2 2.6"/>
                <circle cx="16.4" cy="7.6" r="1"/>
              </svg>
            </div>
            <div>
              <h1 className="text-[17px] font-semibold text-[#0F262A] leading-tight flex items-center gap-2">
                SeaGO · Calculadora de Operação
              </h1>
              <p className="text-[11.5px] text-[#7A9296] font-medium tracking-wider uppercase mt-0.5">
                Precificação e Lucratividade
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isSyncing ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#DBEDEE] text-[#0B6E78] border border-[#0B6E78]/30 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0B6E78]" />
                <span>Salvando na nuvem...</span>
              </div>
            ) : fonte === 'supabase' && isSupabaseConfigured ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#DBEDEE] text-[#0B6E78] border border-[#0B6E78]/30">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <Database className="w-3.5 h-3.5 text-[#0B6E78]" />
                <span>Online · Nuvem Ativa</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200" title="Operando em modo local de segurança. Sincronizará automaticamente quando o banco reconectar.">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Modo Local · Auto-Sync</span>
              </div>
            )}
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto pt-1 -mb-px">
          {[
            { id: 'revisao', label: 'Resultado Operacional' },
            { id: 'mp', label: 'Matéria-prima' },
            { id: 'cif', label: 'CIF (Custos Indiretos)' },
            { id: 'param', label: 'Parâmetros & Dados' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-[#0B6E78] text-[#0B6E78] font-semibold'
                  : 'border-transparent text-[#4C666A] hover:text-[#0F262A]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
};
