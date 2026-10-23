import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { RevisaoView } from './components/RevisaoView';
import { MateriaPrimaView } from './components/MateriaPrimaView';
import { CifView } from './components/CifView';
import { ParametrosView } from './components/ParametrosView';
import { ModalLote } from './components/ModalLote';
import { ModalCif } from './components/ModalCif';
import { Lote, CifLancamento, Parametros } from './types';
import {
  carregarDados,
  salvarDadosLocal,
  salvarLoteDb,
  removerLoteDb,
  salvarCifDb,
  removerCifDb,
  salvarParametrosDb,
  sincronizarComSupabase,
  marcarSincronizacaoPendente,
  isSupabaseConfigured,
  supabase
} from './lib/supabase';
import { PARAMETROS_PADRAO, DADOS_INICIAIS } from './lib/mockData';
import { getCargas } from './lib/calculations';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'revisao' | 'mp' | 'cif' | 'param'>('revisao');
  const [cargaSelecionada, setCargaSelecionada] = useState<number | 'TOTAL'>('TOTAL');
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [cif, setCif] = useState<CifLancamento[]>([]);
  const [parametros, setParametros] = useState<Parametros>(PARAMETROS_PADRAO);
  const [fonte, setFonte] = useState<'supabase' | 'local'>('local');
  const [carregando, setCarregando] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState<{ mensagem: string; tipo: 'ok' | 'erro' } | null>(null);

  // Estados dos Modais
  const [modalLoteAberto, setModalLoteAberto] = useState(false);
  const [loteParaEditar, setLoteParaEditar] = useState<{ lote: Lote; index: number } | null>(null);

  const [modalCifAberto, setModalCifAberto] = useState(false);
  const [cifParaEditar, setCifParaEditar] = useState<{ cif: CifLancamento; index: number } | null>(null);

  const mostrarToast = (mensagem: string, tipo: 'ok' | 'erro' = 'ok') => {
    setToast({ mensagem, tipo });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const recarregarDadosSilencioso = useCallback(async () => {
    try {
      const res = await carregarDados();
      setLotes(res.lotes);
      setCif(res.cif);
      setParametros(res.parametros);
      setFonte(res.fonte);
    } catch (e) {
      console.warn('Erro ao atualizar dados em tempo real:', e);
    }
  }, []);

  useEffect(() => {
    async function inicializar() {
      setCarregando(true);
      const res = await carregarDados();
      setLotes(res.lotes);
      setCif(res.cif);
      setParametros(res.parametros);
      setFonte(res.fonte);

      const listaCargas = getCargas(res.lotes, res.cif);
      if (listaCargas.length > 0) {
        setCargaSelecionada(listaCargas[listaCargas.length - 1]);
      }
      setCarregando(false);
    }
    inicializar();

    // Atualiza automaticamente quando a janela ganha foco (ex: trocar de aba ou voltar pro app)
    const onFocus = () => {
      recarregarDadosSilencioso();
    };
    window.addEventListener('focus', onFocus);

    // Escuta alterações em tempo real no Supabase (Realtime)
    let channel: any = null;
    if (isSupabaseConfigured && supabase) {
      try {
        channel = supabase
          .channel('schema-db-changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'lotes' },
            () => recarregarDadosSilencioso()
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'cif_lancamentos' },
            () => recarregarDadosSilencioso()
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'cargas' },
            () => recarregarDadosSilencioso()
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'parametros' },
            () => recarregarDadosSilencioso()
          )
          .subscribe();
      } catch (err) {
        console.warn('Realtime subscription:', err);
      }
    }

    return () => {
      window.removeEventListener('focus', onFocus);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [recarregarDadosSilencioso]);

  // Funções de CRUD: Lotes
  const handleSalvarLote = async (lote: Lote, index?: number): Promise<string | void> => {
    const colide = lotes.some(
      (x, i) => i !== index && Number(x.carga) === Number(lote.carga) && Number(x.lote) === Number(lote.lote)
    );
    if (colide) {
      return `Já existe o Lote ${lote.lote} na Carga ${lote.carga}.`;
    }

    setIsSyncing(true);
    let loteSalvo = lote;
    let salvouNuvem = false;

    if (isSupabaseConfigured) {
      try {
        loteSalvo = await salvarLoteDb(lote);
        salvouNuvem = true;
        setFonte('supabase');
        marcarSincronizacaoPendente(false);
      } catch (err: any) {
        console.warn('Banco em repouso/offline, salvando localmente com fila de sincronização:', err);
        setFonte('local');
        marcarSincronizacaoPendente(true);
      }
    }

    let novosLotes: Lote[];
    if (index !== undefined && index >= 0) {
      novosLotes = lotes.map((item, idx) => (idx === index ? loteSalvo : item));
    } else {
      novosLotes = [...lotes, loteSalvo];
      setCargaSelecionada(loteSalvo.carga);
    }

    setLotes(novosLotes);
    salvarDadosLocal(novosLotes, cif, parametros);
    setIsSyncing(false);
    mostrarToast(
      salvouNuvem
        ? `Lote ${loteSalvo.lote} da Carga ${loteSalvo.carga} salvo na nuvem!`
        : `Lote ${loteSalvo.lote} salvo! Sincronizará na nuvem assim que o banco responder.`
    );
  };

  const handleRemoverLote = async (index: number): Promise<void> => {
    const loteParaRemover = lotes[index];
    const novosLotes = lotes.filter((_, i) => i !== index);
    setLotes(novosLotes);
    salvarDadosLocal(novosLotes, cif, parametros);

    setIsSyncing(true);
    if (isSupabaseConfigured && loteParaRemover) {
      try {
        await removerLoteDb(loteParaRemover);
        setFonte('supabase');
      } catch (err: any) {
        console.warn('Erro ao remover lote do Supabase (modo offline):', err);
        setFonte('local');
        marcarSincronizacaoPendente(true);
      }
    }
    setIsSyncing(false);
    mostrarToast('Lote excluído com sucesso!');
  };

  // Funções de CRUD: CIF
  const handleSalvarCif = async (itemCif: CifLancamento, index?: number): Promise<string | void> => {
    setIsSyncing(true);
    let cifSalvo = itemCif;
    let salvouNuvem = false;

    if (isSupabaseConfigured) {
      try {
        cifSalvo = await salvarCifDb(itemCif);
        salvouNuvem = true;
        setFonte('supabase');
        marcarSincronizacaoPendente(false);
      } catch (err: any) {
        console.warn('Banco em repouso/offline, salvando CIF localmente:', err);
        setFonte('local');
        marcarSincronizacaoPendente(true);
      }
    }

    let novosCif: CifLancamento[];
    if (index !== undefined && index >= 0) {
      novosCif = cif.map((item, idx) => (idx === index ? cifSalvo : item));
    } else {
      novosCif = [...cif, cifSalvo];
      setCargaSelecionada(cifSalvo.carga);
    }

    setCif(novosCif);
    salvarDadosLocal(lotes, novosCif, parametros);
    setIsSyncing(false);
    mostrarToast(
      salvouNuvem
        ? `Lançamento "${cifSalvo.tipo}" salvo na nuvem!`
        : `Lançamento "${cifSalvo.tipo}" salvo! Sincronizará na nuvem assim que o banco responder.`
    );
  };

  const handleRemoverCif = async (index: number): Promise<void> => {
    const cifParaRemover = cif[index];
    const novosCif = cif.filter((_, i) => i !== index);
    setCif(novosCif);
    salvarDadosLocal(lotes, novosCif, parametros);

    setIsSyncing(true);
    if (isSupabaseConfigured && cifParaRemover) {
      try {
        await removerCifDb(cifParaRemover);
        setFonte('supabase');
      } catch (err: any) {
        console.warn('Erro ao remover CIF do Supabase (modo offline):', err);
        setFonte('local');
        marcarSincronizacaoPendente(true);
      }
    }
    setIsSyncing(false);
    mostrarToast('Lançamento excluído com sucesso!');
  };

  const handleAtualizarParametros = async (novos: Partial<Parametros>) => {
    const atualizados: Parametros = { ...parametros, ...novos };
    setParametros(atualizados);
    salvarDadosLocal(lotes, cif, atualizados);

    if (isSupabaseConfigured) {
      setIsSyncing(true);
      try {
        await salvarParametrosDb(atualizados);
        setFonte('supabase');
        mostrarToast('Parâmetros atualizados na nuvem!');
      } catch (err: any) {
        console.warn('Erro ao salvar parâmetros no Supabase:', err);
        setFonte('local');
        marcarSincronizacaoPendente(true);
        mostrarToast('Parâmetros salvos! Sincronizarão quando o banco reconectar.');
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // Carga ativa para novos registros
  const todasCargas = getCargas(lotes, cif);
  const cargaAtiva = cargaSelecionada === 'TOTAL' ? todasCargas[todasCargas.length - 1] || 1 : cargaSelecionada;

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#F2F6F6] flex items-center justify-center text-[#0F262A]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#0B6E78] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-[#4C666A]">Carregando dados da SeaGO em tempo real...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F6F6] text-[#0F262A] flex flex-col selection:bg-[#DBEDEE] selection:text-[#0B6E78] relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-in slide-in-from-top-3 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
              toast.tipo === 'ok'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            {toast.tipo === 'ok' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-none" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-none" />
            )}
            <span>{toast.mensagem}</span>
          </div>
        </div>
      )}

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        fonte={fonte}
        isSyncing={isSyncing}
      />

      <main className="flex-1 max-w-[1120px] w-full mx-auto px-5 py-6">
        {activeTab === 'revisao' && (
          <RevisaoView
            lotes={lotes}
            cif={cif}
            parametros={parametros}
            cargaSelecionada={cargaSelecionada}
            setCargaSelecionada={setCargaSelecionada}
          />
        )}

        {activeTab === 'mp' && (
          <MateriaPrimaView
            lotes={lotes}
            parametros={parametros}
            onAdicionar={() => {
              setLoteParaEditar(null);
              setModalLoteAberto(true);
            }}
            onEditar={(lote, index) => {
              setLoteParaEditar({ lote, index });
              setModalLoteAberto(true);
            }}
          />
        )}

        {activeTab === 'cif' && (
          <CifView
            cif={cif}
            onAdicionar={() => {
              setCifParaEditar(null);
              setModalCifAberto(true);
            }}
            onEditar={(item, index) => {
              setCifParaEditar({ cif: item, index });
              setModalCifAberto(true);
            }}
          />
        )}

        {activeTab === 'param' && (
          <ParametrosView
            parametros={parametros}
            onAtualizarParametros={handleAtualizarParametros}
            lotes={lotes}
            cif={cif}
            onImportarDados={async (dados) => {
              const p = dados.parametros || parametros;
              setLotes(dados.lotes);
              setCif(dados.cif);
              setParametros(p);
              salvarDadosLocal(dados.lotes, dados.cif, p);
              if (isSupabaseConfigured) {
                await sincronizarComSupabase(dados.lotes, dados.cif, p);
              }
              mostrarToast('Dados importados e salvos com sucesso!');
            }}
            onRestaurarOriginais={async () => {
              setLotes(DADOS_INICIAIS.lotes);
              setCif(DADOS_INICIAIS.cif);
              setParametros(PARAMETROS_PADRAO);
              salvarDadosLocal(DADOS_INICIAIS.lotes, DADOS_INICIAIS.cif, PARAMETROS_PADRAO);
              if (isSupabaseConfigured) {
                await sincronizarComSupabase(DADOS_INICIAIS.lotes, DADOS_INICIAIS.cif, PARAMETROS_PADRAO);
              }
              mostrarToast('Dados originais restaurados com sucesso!');
            }}
          />
        )}
      </main>

      <footer className="mt-12 py-5 border-t border-[#D2E0E0] text-center text-xs text-[#7A9296]">
        SeaGO · Calculadora de Operação e Precificação · Dados sincronizados automaticamente em tempo real
      </footer>

      {/* Modais */}
      <ModalLote
        isOpen={modalLoteAberto}
        onClose={() => setModalLoteAberto(false)}
        loteParaEditar={loteParaEditar}
        cargaAtiva={cargaAtiva}
        parametros={parametros}
        onSalvar={handleSalvarLote}
        onRemover={handleRemoverLote}
      />

      <ModalCif
        isOpen={modalCifAberto}
        onClose={() => setModalCifAberto(false)}
        cifParaEditar={cifParaEditar}
        cargaAtiva={cargaAtiva}
        onSalvar={handleSalvarCif}
        onRemover={handleRemoverCif}
      />
    </div>
  );
}

export default App;
