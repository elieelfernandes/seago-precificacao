import { createClient } from '@supabase/supabase-js';
import { Lote, CifLancamento, Parametros } from '../types';
import { DADOS_INICIAIS, PARAMETROS_PADRAO } from './mockData';

const DEFAULT_SUPABASE_URL = 'https://snxwgmgrdzcgtefmkqel.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNueHdnbWdyZHpjZ3RlZm1rcWVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMzk4OTYsImV4cCI6MjEwNjgxNTg5Nn0.rERM_vjFGMRWMBmO93aKq2LWvpA9M5q9CAnSlBZ2_C0';

const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Ignora automaticamente o projeto antigo desativado (mewenajmiugrsicirdgn) caso ainda esteja nas variáveis da Vercel
const usarDefault = !envUrl || envUrl.includes('mewenajmiugrsicirdgn') || envUrl === 'https://sua-url-aqui.supabase.co';

const supabaseUrl = usarDefault ? DEFAULT_SUPABASE_URL : envUrl;
const supabaseAnonKey = usarDefault ? DEFAULT_SUPABASE_ANON_KEY : envKey;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://sua-url-aqui.supabase.co'
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const STORAGE_KEY = 'seago-dados-v2';
const PENDING_SYNC_KEY = 'seago-pending-sync';

export function marcarSincronizacaoPendente(pendente: boolean): void {
  try {
    if (pendente) {
      localStorage.setItem(PENDING_SYNC_KEY, 'true');
    } else {
      localStorage.removeItem(PENDING_SYNC_KEY);
    }
  } catch (e) {}
}

export function temSincronizacaoPendente(): boolean {
  try {
    return localStorage.getItem(PENDING_SYNC_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

// Garante que a carga existe no Supabase e retorna seu ID atualizado
export async function obterOuCriarCargaId(numeroCarga: number, dataOperacao?: string): Promise<string> {
  if (!supabase) throw new Error('Supabase não configurado');

  const { data: cargaExistente, error: errBusca } = await supabase
    .from('cargas')
    .select('id')
    .eq('numero', Number(numeroCarga))
    .maybeSingle();

  if (errBusca) {
    console.error('Erro ao buscar carga no Supabase:', errBusca);
  }

  if (cargaExistente?.id) {
    return cargaExistente.id;
  }

  const { data: novaCarga, error: errInsert } = await supabase
    .from('cargas')
    .insert({
      numero: Number(numeroCarga),
      data_operacao: dataOperacao || new Date().toISOString().slice(0, 10),
      status: 'fechada'
    })
    .select('id')
    .single();

  if (errInsert || !novaCarga) {
    throw new Error('Erro ao criar carga no Supabase: ' + (errInsert?.message || 'Carga não criada'));
  }

  return novaCarga.id;
}

export async function carregarDados(): Promise<{
  lotes: Lote[];
  cif: CifLancamento[];
  parametros: Parametros;
  fonte: 'supabase' | 'local';
}> {
  if (isSupabaseConfigured && supabase) {
    try {
      // 1. Carrega parâmetros
      const { data: paramData, error: errParam } = await supabase
        .from('parametros')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (errParam) console.warn('Aviso ao ler parâmetros do Supabase:', errParam);

      // 2. Carrega cargas para mapeamento de ID -> número
      const { data: cargasData, error: errCargas } = await supabase
        .from('cargas')
        .select('*')
        .order('numero', { ascending: true });
      
      if (errCargas) console.warn('Aviso ao ler cargas do Supabase:', errCargas);

      const cargaMap = new Map<string, number>();
      cargasData?.forEach(c => cargaMap.set(c.id, Number(c.numero)));

      // 3. Carrega lotes ordenados
      const { data: lotesData, error: errLotes } = await supabase
        .from('lotes')
        .select('*')
        .order('data', { ascending: false })
        .order('numero_lote', { ascending: true });

      if (errLotes) console.warn('Aviso ao ler lotes do Supabase:', errLotes);

      const lotes: Lote[] = (lotesData || []).map(l => ({
        id: l.id,
        carga_id: l.carga_id,
        carga: cargaMap.get(l.carga_id) ?? 1,
        lote: Number(l.numero_lote),
        data: l.data || new Date().toISOString().slice(0, 10),
        fornecedor: l.fornecedor || '',
        classificacao: l.classificacao || '',
        gr_inicial: l.gr_inicial ? Number(l.gr_inicial) : null,
        gr_final: l.gr_final ? Number(l.gr_final) : null,
        valor_compra_kg: Number(l.valor_compra_kg) || 0,
        qtd_comprada: Number(l.qtd_comprada) || 0,
        qtd_final: l.qtd_final_medida ? Number(l.qtd_final_medida) : null,
        valor_venda_kg: Number(l.valor_venda_kg) || 0,
      }));

      // 4. Carrega CIF ordenados
      const { data: cifData, error: errCif } = await supabase
        .from('cif_lancamentos')
        .select('*')
        .order('data', { ascending: false });

      if (errCif) console.warn('Aviso ao ler CIF do Supabase:', errCif);

      const cif: CifLancamento[] = (cifData || []).map(c => ({
        id: c.id,
        carga_id: c.carga_id,
        carga: cargaMap.get(c.carga_id) ?? 1,
        data: c.data || new Date().toISOString().slice(0, 10),
        tipo: c.tipo_custo || '',
        qtd: Number(c.qtd) || 0,
        valor: Number(c.valor_unitario) || 0,
      }));

      // Tenta recuperar porCarga do banco (se existir coluna por_carga) ou do localStorage
      let porCargaSalvo: Record<number, { kgCaixa: number; enxarqueKg: number }> = {};
      if (paramData && (paramData as any).por_carga) {
        try {
          porCargaSalvo = typeof (paramData as any).por_carga === 'string'
            ? JSON.parse((paramData as any).por_carga)
            : (paramData as any).por_carga;
        } catch (e) {}
      } else {
        try {
          const rawLocal = localStorage.getItem(STORAGE_KEY);
          if (rawLocal) {
            const parsed = JSON.parse(rawLocal);
            if (parsed.parametros?.porCarga) {
              porCargaSalvo = parsed.parametros.porCarga;
            }
          }
        } catch (e) {}
      }

      const parametros: Parametros = paramData ? {
        id: paramData.id,
        kgCaixa: Number(paramData.kg_caixa) || 16,
        enxarqueKg: Number(paramData.enxarque_kg) ?? 1,
        porCarga: porCargaSalvo,
        atualizadoEm: paramData.updated_at
      } : { ...PARAMETROS_PADRAO, porCarga: porCargaSalvo };

      if (errCargas || errLotes || errCif) {
        throw new Error(
          errCargas?.message || errLotes?.message || errCif?.message || 'Erro de leitura no Supabase'
        );
      }

      if (lotes.length > 0 || cif.length > 0) {
        // Verifica se há dados locais pendentes ou Cargas novas no navegador (ex: Carga 7 preenchida antes da migração ou offline)
        try {
          const rawLocal = localStorage.getItem(STORAGE_KEY);
          if (rawLocal) {
            const parsed = JSON.parse(rawLocal);
            const localLotes: Lote[] = Array.isArray(parsed.lotes) ? parsed.lotes : [];
            const localCif: CifLancamento[] = Array.isArray(parsed.cif) ? parsed.cif : [];

            if (temSincronizacaoPendente() && (localLotes.length > 0 || localCif.length > 0)) {
              const localParam: Parametros = parsed.parametros || parametros;
              await sincronizarComSupabase(localLotes, localCif, localParam);
              marcarSincronizacaoPendente(false);
              salvarDadosLocal(localLotes, localCif, localParam);
              return { lotes: localLotes, cif: localCif, parametros: localParam, fonte: 'supabase' };
            }

            // Resgate automático de cargas locais que ainda não subiram pro banco (ex: Carga 7 no navegador do cliente)
            const cargasNoBanco = new Set(cargasData?.map(c => Number(c.numero)) || []);
            const lotesFaltantes = localLotes.filter(l => !cargasNoBanco.has(Number(l.carga)));
            const cifFaltantes = localCif.filter(c => !cargasNoBanco.has(Number(c.carga)));

            if (lotesFaltantes.length > 0 || cifFaltantes.length > 0) {
              for (const lf of lotesFaltantes) {
                try {
                  const salvo = await salvarLoteDb(lf);
                  lotes.push(salvo);
                } catch (e) {
                  lotes.push(lf);
                }
              }
              for (const cf of cifFaltantes) {
                try {
                  const salvo = await salvarCifDb(cf);
                  cif.push(salvo);
                } catch (e) {
                  cif.push(cf);
                }
              }
            }
          }
        } catch (e) {
          console.warn('Aviso ao mesclar cache local:', e);
        }

        // Atualiza cache local de segurança
        salvarDadosLocal(lotes, cif, parametros);
        return { lotes, cif, parametros, fonte: 'supabase' };
      }
    } catch (err) {
      console.warn('Erro ao carregar do Supabase, recorrendo ao armazenamento local:', err);
    }
  }

  // Fallback para localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.lotes && parsed.cif) {
        return {
          lotes: parsed.lotes,
          cif: parsed.cif,
          parametros: parsed.parametros || PARAMETROS_PADRAO,
          fonte: 'local'
        };
      }
    }
  } catch (e) {
    console.error('Erro ao ler localStorage', e);
  }

  return {
    lotes: DADOS_INICIAIS.lotes,
    cif: DADOS_INICIAIS.cif,
    parametros: PARAMETROS_PADRAO,
    fonte: 'local'
  };
}

export function salvarDadosLocal(
  lotes: Lote[],
  cif: CifLancamento[],
  parametros: Parametros
): void {
  try {
    const payload = {
      lotes,
      cif,
      parametros: {
        ...parametros,
        atualizadoEm: new Date().toISOString().slice(0, 10)
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error('Erro ao salvar local:', e);
  }
}

// Salvar / Atualizar Lote diretamente no Supabase com validação e retorno
export async function salvarLoteDb(lote: Lote): Promise<Lote> {
  if (!isSupabaseConfigured || !supabase) return lote;

  const cargaId = await obterOuCriarCargaId(Number(lote.carga), lote.data);

  const payload = {
    carga_id: cargaId,
    numero_lote: Number(lote.lote),
    data: lote.data,
    fornecedor: lote.fornecedor || '',
    classificacao: lote.classificacao || '',
    gr_inicial: lote.gr_inicial ? Number(lote.gr_inicial) : null,
    gr_final: lote.gr_final ? Number(lote.gr_final) : null,
    valor_compra_kg: Number(lote.valor_compra_kg) || 0,
    qtd_comprada: Number(lote.qtd_comprada) || 0,
    qtd_final_medida: lote.qtd_final ? Number(lote.qtd_final) : null,
    valor_venda_kg: Number(lote.valor_venda_kg) || 0
  };

  if (lote.id) {
    const { data, error } = await supabase
      .from('lotes')
      .update(payload)
      .eq('id', lote.id)
      .select('id, carga_id')
      .single();

    if (error) {
      console.error('Erro ao fazer update de lote, tentando upsert:', error);
      // Fallback para upsert se o ID não foi encontrado
      const { data: upsertData, error: errUpsert } = await supabase
        .from('lotes')
        .upsert(payload, { onConflict: 'carga_id,numero_lote' })
        .select('id, carga_id')
        .single();
      if (errUpsert) throw new Error('Erro ao salvar lote no banco: ' + errUpsert.message);
      return { ...lote, id: upsertData.id, carga_id: upsertData.carga_id };
    }
    return { ...lote, id: data.id, carga_id: data.carga_id };
  } else {
    const { data, error } = await supabase
      .from('lotes')
      .upsert(payload, { onConflict: 'carga_id,numero_lote' })
      .select('id, carga_id')
      .single();

    if (error) throw new Error('Erro ao inserir lote no banco: ' + error.message);
    return { ...lote, id: data.id, carga_id: data.carga_id };
  }
}

// Remover Lote no Supabase
export async function removerLoteDb(lote: Lote): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  if (lote.id) {
    const { error } = await supabase.from('lotes').delete().eq('id', lote.id);
    if (error) console.error('Erro ao excluir lote por ID:', error);
  } else {
    const cargaId = await obterOuCriarCargaId(Number(lote.carga));
    const { error } = await supabase
      .from('lotes')
      .delete()
      .eq('carga_id', cargaId)
      .eq('numero_lote', Number(lote.lote));
    if (error) console.error('Erro ao excluir lote por carga/lote:', error);
  }
}

// Salvar / Atualizar CIF diretamente no Supabase com validação e retorno
export async function salvarCifDb(cifItem: CifLancamento): Promise<CifLancamento> {
  if (!isSupabaseConfigured || !supabase) return cifItem;

  const cargaId = await obterOuCriarCargaId(Number(cifItem.carga), cifItem.data);

  const payload = {
    carga_id: cargaId,
    data: cifItem.data,
    tipo_custo: cifItem.tipo,
    qtd: Number(cifItem.qtd) || 0,
    valor_unitario: Number(cifItem.valor) || 0
  };

  if (cifItem.id) {
    const { data, error } = await supabase
      .from('cif_lancamentos')
      .update(payload)
      .eq('id', cifItem.id)
      .select('id, carga_id')
      .single();

    if (error) {
      console.error('Erro ao atualizar CIF por ID, tentando inserção:', error);
      const { data: insData, error: insErr } = await supabase
        .from('cif_lancamentos')
        .insert(payload)
        .select('id, carga_id')
        .single();
      if (insErr) throw new Error('Erro ao salvar CIF: ' + insErr.message);
      return { ...cifItem, id: insData.id, carga_id: insData.carga_id };
    }
    return { ...cifItem, id: data.id, carga_id: data.carga_id };
  } else {
    const { data, error } = await supabase
      .from('cif_lancamentos')
      .insert(payload)
      .select('id, carga_id')
      .single();

    if (error) throw new Error('Erro ao inserir CIF no banco: ' + error.message);
    return { ...cifItem, id: data.id, carga_id: data.carga_id };
  }
}

// Remover CIF no Supabase
export async function removerCifDb(cifItem: CifLancamento): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  if (cifItem.id) {
    const { error } = await supabase.from('cif_lancamentos').delete().eq('id', cifItem.id);
    if (error) console.error('Erro ao excluir CIF por ID:', error);
  } else {
    const cargaId = await obterOuCriarCargaId(Number(cifItem.carga));
    const { error } = await supabase
      .from('cif_lancamentos')
      .delete()
      .eq('carga_id', cargaId)
      .eq('tipo_custo', cifItem.tipo)
      .eq('data', cifItem.data);
    if (error) console.error('Erro ao excluir CIF por tipo/data:', error);
  }
}

// Salvar Parâmetros no Supabase (incluindo porCarga)
export async function salvarParametrosDb(parametros: Parametros): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  const { data: p } = await supabase.from('parametros').select('id').limit(1).maybeSingle();
  
  const payloadComPorCarga: any = {
    kg_caixa: Number(parametros.kgCaixa) || 16,
    enxarque_kg: Number(parametros.enxarqueKg) ?? 1,
    por_carga: parametros.porCarga || {}
  };

  const payloadSimples: any = {
    kg_caixa: Number(parametros.kgCaixa) || 16,
    enxarque_kg: Number(parametros.enxarqueKg) ?? 1
  };

  if (p?.id) {
    // Tenta atualizar com por_carga
    const { error } = await supabase.from('parametros').update(payloadComPorCarga).eq('id', p.id);
    if (error) {
      // Se der erro (ex: coluna por_carga ainda não adicionada), faz update simples
      await supabase.from('parametros').update(payloadSimples).eq('id', p.id);
    }
  } else {
    const { error } = await supabase.from('parametros').insert(payloadComPorCarga);
    if (error) {
      await supabase.from('parametros').insert(payloadSimples);
    }
  }
}

// Sincronização em lote completa
export async function sincronizarComSupabase(
  lotes: Lote[],
  cif: CifLancamento[],
  parametros: Parametros
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, message: 'Supabase não configurado. Dados salvos localmente no navegador.' };
  }

  try {
    // 1. Parâmetros
    await salvarParametrosDb(parametros);

    // 2. Cargas
    const numerosCargas = Array.from(new Set([
      ...lotes.map(l => Number(l.carga)),
      ...cif.map(c => Number(c.carga))
    ]));

    for (const num of numerosCargas) {
      await obterOuCriarCargaId(num);
    }

    // 3. Salva todos os lotes
    for (const l of lotes) {
      await salvarLoteDb(l);
    }

    // 4. Salva todos os CIFs
    for (const c of cif) {
      await salvarCifDb(c);
    }

    return { success: true, message: 'Tudo sincronizado com o Supabase com sucesso!' };
  } catch (err: any) {
    console.error('Erro na sincronização completa:', err);
    return { success: false, message: 'Erro ao sincronizar: ' + (err.message || 'Erro desconhecido') };
  }
}
