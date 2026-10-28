import React, { useState, useEffect } from 'react';
import { Lote, CifLancamento, Parametros } from '../types';
import {
  calcularResultado,
  getCargas,
  getParametrosDaCarga,
  brl,
  brl0,
  nf,
  pct
} from '../lib/calculations';
import { KpiCard } from './KpiCard';
import {
  ArrowRight,
  Calculator,
  Clock,
  DollarSign,
  Percent,
  RotateCcw,
  Sparkles,
  TrendingUp,
  BadgePercent,
  CheckCircle2
} from 'lucide-react';

interface OrcamentoViewProps {
  lotes: Lote[];
  cif: CifLancamento[];
  parametros: Parametros;
  cargaSelecionada: number | 'TOTAL';
}

export const OrcamentoView: React.FC<OrcamentoViewProps> = ({
  lotes,
  cif,
  parametros,
  cargaSelecionada
}) => {
  const todasCargas = getCargas(lotes, cif);
  const cargaPadrao =
    cargaSelecionada === 'TOTAL'
      ? todasCargas[todasCargas.length - 1] || 1
      : cargaSelecionada;

  const [cargaBase, setCargaBase] = useState<number | 'LIVRE'>(cargaPadrao);

  // Campos de Operação (Custo & Volume)
  const [qtdComprada, setQtdComprada] = useState<number>(11200);
  const [precoCompraKg, setPrecoCompraKg] = useState<number>(23.0);
  const [cifTotalSimulado, setCifTotalSimulado] = useState<number>(37805);
  const [kgCaixa, setKgCaixa] = useState<number>(parametros.kgCaixa || 16);
  const [enxarqueKg, setEnxarqueKg] = useState<number>(parametros.enxarqueKg ?? 1);

  // Campos Comerciais: Valor Inicial (Vista) -> Valor Final (Prazo) -> Tempo de Prazo -> Taxa
  const [precoVistaKg, setPrecoVistaKg] = useState<number>(26.5);
  const [acrescimoPrazoKg, setAcrescimoPrazoKg] = useState<number>(2.0); // Em média R$ 2,00 a mais que à vista
  const [precoPrazoKg, setPrecoPrazoKg] = useState<number>(28.5);
  const [diasPrazo, setDiasPrazo] = useState<number>(30);
  const [custoCapitalMensalPct, setCustoCapitalMensalPct] = useState<number>(2.0); // Custo de capital (% a.m.)
  const [descontoFinanceiroManual, setDescontoFinanceiroManual] = useState<number | null>(null);
  const [modoVisualizacao, setModoVisualizacao] = useState<'comparativo' | 'cliente'>('comparativo');

  // Carrega dados de uma carga real quando selecionada como base
  const carregarDeCarga = (numCarga: number) => {
    const r = calcularResultado(numCarga, lotes, cif, parametros);
    const paramC = getParametrosDaCarga(numCarga, parametros);

    setKgCaixa(paramC.kgCaixa);
    setEnxarqueKg(paramC.enxarqueKg);

    if (r.completa) {
      setQtdComprada(r.kgComprado);
      setPrecoCompraKg(Number(r.mpPorKg.toFixed(4)));
      setCifTotalSimulado(Number(r.cifTotal.toFixed(2)));
      const vistaBase = Number(r.precoMedio.toFixed(2));
      setPrecoVistaKg(vistaBase);
      setPrecoPrazoKg(Number((vistaBase + acrescimoPrazoKg).toFixed(2)));
    } else {
      setCifTotalSimulado(Number(r.cifTotal.toFixed(2)));
    }
  };

  useEffect(() => {
    if (cargaBase !== 'LIVRE') {
      carregarDeCarga(cargaBase);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargaBase]);

  // Handlers sincronizados entre Preço à Vista, Acréscimo (R$) e Preço a Prazo
  const handleChangeVista = (novoVista: number) => {
    setPrecoVistaKg(novoVista);
    setPrecoPrazoKg(Number((novoVista + acrescimoPrazoKg).toFixed(4)));
  };

  const handleChangeAcrescimo = (novoAcrescimo: number) => {
    setAcrescimoPrazoKg(novoAcrescimo);
    setPrecoPrazoKg(Number((precoVistaKg + novoAcrescimo).toFixed(4)));
  };

  const handleChangePrazoPreco = (novoPrazo: number) => {
    setPrecoPrazoKg(novoPrazo);
    setAcrescimoPrazoKg(Number((novoPrazo - precoVistaKg).toFixed(4)));
  };

  const handleChangeTaxaJurosPeriodo = (novaTaxaPct: number) => {
    const fator = 1 + novaTaxaPct / 100;
    const novoPrazo = Number((precoVistaKg * fator).toFixed(2));
    setPrecoPrazoKg(novoPrazo);
    setAcrescimoPrazoKg(Number((novoPrazo - precoVistaKg).toFixed(2)));
  };

  const handleChangeTaxaDescontoVista = (novoDescontoPct: number) => {
    if (novoDescontoPct >= 100 || novoDescontoPct < 0) return;
    // Se precoVista = precoPrazo * (1 - desc), então mantendo precoPrazo ou mantendo precoVista:
    // Mantendo o preço à vista base e ajustando o preço a prazo tabela:
    const divisor = 1 - novoDescontoPct / 100;
    if (divisor > 0) {
      const novoPrazo = Number((precoVistaKg / divisor).toFixed(2));
      setPrecoPrazoKg(novoPrazo);
      setAcrescimoPrazoKg(Number((novoPrazo - precoVistaKg).toFixed(2)));
    }
  };

  // Cálculos Operacionais de Volume e Custos
  const caixas = kgCaixa > 0 ? qtdComprada / kgCaixa : 0;
  const enxarqueTotal = caixas * enxarqueKg;
  const qtdVendida = qtdComprada + enxarqueTotal;

  const custoMpTotal = qtdComprada * precoCompraKg;
  const custoTotalOperacao = custoMpTotal + cifTotalSimulado;
  const custoPorKgVendido = qtdVendida > 0 ? custoTotalOperacao / qtdVendida : 0;
  const cifPorKgVendido = qtdVendida > 0 ? cifTotalSimulado / qtdVendida : 0;

  // Cálculos Financeiros: Valor Inicial (Vista) -> Valor Final (Prazo) -> Prazo -> Taxa
  const diferencaPorKg = precoPrazoKg - precoVistaKg;
  // Taxa de juros embutida no período (de À Vista para A Prazo)
  const taxaJurosPeriodo = precoVistaKg > 0 ? diferencaPorKg / precoVistaKg : 0;
  // Taxa de desconto comercial para pagamento à vista (de A Prazo para À Vista)
  const taxaDescontoVista = precoPrazoKg > 0 ? diferencaPorKg / precoPrazoKg : 0;

  // Equivalências mensais e diárias
  const mesesPrazo = diasPrazo > 0 ? diasPrazo / 30 : 1;
  const taxaJurosMensalSimples = mesesPrazo > 0 ? taxaJurosPeriodo / mesesPrazo : 0;
  const taxaJurosMensalComposta =
    precoVistaKg > 0 && precoPrazoKg > 0 && diasPrazo > 0
      ? Math.pow(precoPrazoKg / precoVistaKg, 30 / diasPrazo) - 1
      : 0;
  const taxaDescontoMensal = mesesPrazo > 0 ? taxaDescontoVista / mesesPrazo : 0;

  // Resultados da Operação: Cenário À VISTA
  const faturamentoVista = qtdVendida * precoVistaKg;
  const lucroVista = faturamentoVista - custoTotalOperacao;
  const margemVista = faturamentoVista > 0 ? lucroVista / faturamentoVista : 0;
  const lucroKgVista = qtdVendida > 0 ? lucroVista / qtdVendida : 0;
  const roiVista = custoTotalOperacao > 0 ? lucroVista / custoTotalOperacao : 0;

  // Resultados da Operação: Cenário A PRAZO (Com Desconto Financeiro / Custo de Capital)
  const faturamentoPrazo = qtdVendida * precoPrazoKg;
  const taxaCustoCapitalPeriodo = (custoCapitalMensalPct / 100) * mesesPrazo;
  const descontoFinanceiro =
    descontoFinanceiroManual !== null
      ? descontoFinanceiroManual
      : Number((faturamentoPrazo * taxaCustoCapitalPeriodo).toFixed(2));
  const lucroPrazoBruto = faturamentoPrazo - custoTotalOperacao;
  const lucroPrazo = faturamentoPrazo - custoTotalOperacao - descontoFinanceiro;
  const margemPrazo = faturamentoPrazo > 0 ? lucroPrazo / faturamentoPrazo : 0;
  const lucroKgPrazo = qtdVendida > 0 ? lucroPrazo / qtdVendida : 0;
  const roiPrazo = custoTotalOperacao > 0 ? lucroPrazo / custoTotalOperacao : 0;

  const handleChangeCustoCapitalPct = (novaTaxaMensal: number) => {
    setDescontoFinanceiroManual(null);
    setCustoCapitalMensalPct(novaTaxaMensal);
  };

  const handleChangeDescontoFinanceiroRs = (novoValorRs: number) => {
    setDescontoFinanceiroManual(novoValorRs);
    if (faturamentoPrazo > 0 && mesesPrazo > 0) {
      const pctPeriodo = (novoValorRs / faturamentoPrazo) * 100;
      setCustoCapitalMensalPct(Number((pctPeriodo / mesesPrazo).toFixed(2)));
    }
  };

  // Diferença total em R$ na carga (Economia do cliente à vista / Ganho financeiro a prazo)
  const diferencaTotalCarga = faturamentoPrazo - faturamentoVista;

  return (
    <section className="space-y-6 animate-in fade-in duration-200">
      {/* Cabeçalho da Aba */}
      <div className="flex items-end justify-between flex-wrap gap-4 pb-2 border-b border-[#D2E0E0]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-[#DBEDEE] text-[#0B6E78] mb-1.5">
            <Sparkles className="w-3 h-3" />
            <span>Simulador Comercial & Financeiro</span>
          </div>
          <h2 className="text-[22px] font-bold tracking-tight text-[#0F262A]">
            Orçamento · Venda à Vista vs. A Prazo
          </h2>
          <p className="text-[13.5px] text-[#4C666A] mt-1 max-w-[720px]">
            Simule preços à vista e a prazo, calcule a taxa de desconto comercial para o cliente e veja o lucro exato da operação da carga.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModoVisualizacao('comparativo')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all border ${
              modoVisualizacao === 'comparativo'
                ? 'bg-[#0B6E78] text-white border-[#0B6E78] shadow-sm'
                : 'bg-white text-[#4C666A] border-[#B6CBCB] hover:border-[#0B6E78]'
            }`}
          >
            Visão Completa (Lucro + Taxas)
          </button>
          <button
            type="button"
            onClick={() => setModoVisualizacao('cliente')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all border ${
              modoVisualizacao === 'cliente'
                ? 'bg-[#0B6E78] text-white border-[#0B6E78] shadow-sm'
                : 'bg-white text-[#4C666A] border-[#B6CBCB] hover:border-[#0B6E78]'
            }`}
          >
            Modo Apresentação (Para o Cliente)
          </button>
        </div>
      </div>

      {/* Seletor de Carga Base para Preenchimento Rápido */}
      <div className="flex items-center gap-2 flex-wrap bg-white border border-[#D2E0E0] rounded-xl p-3.5 shadow-sm">
        <span className="text-[11.5px] uppercase tracking-wider font-semibold text-[#7A9296] mr-1">
          Puxar dados base de:
        </span>
        <button
          type="button"
          onClick={() => setCargaBase('LIVRE')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            cargaBase === 'LIVRE'
              ? 'bg-[#0F262A] border-[#0F262A] text-white'
              : 'bg-[#F2F6F6] border-[#B6CBCB] text-[#4C666A] hover:border-[#0B6E78]'
          }`}
        >
          Preenchimento Livre
        </button>

        <span className="w-px h-4 bg-[#D2E0E0] mx-1" />

        {todasCargas.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setCargaBase(c);
              carregarDeCarga(c);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              cargaBase === c
                ? 'bg-[#0B6E78] border-[#0B6E78] text-white shadow-sm'
                : 'bg-white border-[#B6CBCB] text-[#4C666A] hover:border-[#0B6E78] hover:text-[#0F262A]'
            }`}
          >
            Carga {c}
          </button>
        ))}

        <div className="ml-auto">
          <button
            type="button"
            onClick={() => {
              setAcrescimoPrazoKg(2.0);
              setDiasPrazo(30);
              if (cargaBase !== 'LIVRE') {
                carregarDeCarga(cargaBase);
              } else {
                setPrecoPrazoKg(Number((precoVistaKg + 2.0).toFixed(2)));
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B6E78] hover:underline px-2 py-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Padrão (+R$ 2,00 / 30d)</span>
          </button>
        </div>
      </div>

      {/* BLOCO PRINCIPAL: FLUXO VALOR INICIAL -> VALOR FINAL -> TEMPO DE PRAZO -> TAXA */}
      <div className="bg-white border-2 border-[#0B6E78]/30 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-[#DBEDEE]/60 border-b border-[#0B6E78]/20 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-[#0B6E78]" />
            <h3 className="text-[13px] uppercase tracking-wider font-bold text-[#0F262A]">
              Cálculo Comercial: Valor Inicial (Vista) → Valor Final (Prazo) → Tempo de Prazo → Taxa
            </h3>
          </div>
          <span className="text-xs text-[#4C666A] font-medium">
            Altere qualquer campo abaixo para simular instantaneamente
          </span>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-stretch">
            {/* Etapa 1: Valor Inicial (À Vista) */}
            <div className="lg:col-span-2 bg-[#F2F6F6] border border-[#D2E0E0] rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#0F7A55]">
                  <span>1. Valor Inicial</span>
                  <DollarSign className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs font-semibold text-[#0F262A] mt-0.5">
                  Venda à Vista (R$/kg)
                </div>
                <div className="mt-3 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-[#7A9296]">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    value={precoVistaKg}
                    onChange={(e) => handleChangeVista(Number(e.target.value) || 0)}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border-2 border-[#0F7A55]/40 rounded-lg text-lg font-mono font-bold text-[#0F7A55] focus:outline-none focus:border-[#0F7A55]"
                  />
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#D2E0E0] text-[11.5px] text-[#4C666A] flex justify-between">
                <span>Total Carga:</span>
                <strong className="font-mono text-[#0F262A]">{brl0(faturamentoVista)}</strong>
              </div>
            </div>

            {/* Seta + Acréscimo R$/kg */}
            <div className="lg:col-span-2 bg-[#E9F0F0]/70 border border-dashed border-[#0B6E78]/40 rounded-xl p-3.5 flex flex-col justify-center items-center text-center">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#0B6E78]">
                Diferença a Prazo (R$/kg)
              </div>
              <p className="text-[11px] text-[#7A9296] mt-0.5">
                Média padrão: +R$ 2,00/kg
              </p>
              <div className="mt-2 flex items-center gap-1.5 w-full max-w-[140px]">
                <span className="text-xs font-mono font-bold text-[#0B6E78]">+R$</span>
                <input
                  type="number"
                  step="0.1"
                  value={acrescimoPrazoKg}
                  onChange={(e) => handleChangeAcrescimo(Number(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 bg-white border border-[#0B6E78] rounded-lg text-center font-mono font-bold text-sm text-[#0B6E78] focus:outline-none"
                />
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px] text-[#4C666A]">
                <span>Soma na carga:</span>
                <b className="font-mono text-[#0B6E78]">+{brl0(diferencaTotalCarga)}</b>
              </div>
            </div>

            {/* Etapa 2: Valor Final (A Prazo) */}
            <div className="lg:col-span-2 bg-[#F2F6F6] border border-[#D2E0E0] rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#0B6E78]">
                  <span>2. Valor Final</span>
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs font-semibold text-[#0F262A] mt-0.5">
                  Venda a Prazo (R$/kg)
                </div>
                <div className="mt-3 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-[#7A9296]">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    value={precoPrazoKg}
                    onChange={(e) => handleChangePrazoPreco(Number(e.target.value) || 0)}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border-2 border-[#0B6E78]/40 rounded-lg text-lg font-mono font-bold text-[#0B6E78] focus:outline-none focus:border-[#0B6E78]"
                  />
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#D2E0E0] text-[11.5px] text-[#4C666A] flex justify-between">
                <span>Total Carga:</span>
                <strong className="font-mono text-[#0F262A]">{brl0(faturamentoPrazo)}</strong>
              </div>
            </div>

            {/* Etapa 3: Tempo de Prazo */}
            <div className="lg:col-span-2 bg-[#F2F6F6] border border-[#D2E0E0] rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#9A6410]">
                  <span>3. Tempo de Prazo</span>
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs font-semibold text-[#0F262A] mt-0.5">
                  Prazo para Pagamento
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={diasPrazo}
                    onChange={(e) => setDiasPrazo(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-3 py-2.5 bg-white border-2 border-[#9A6410]/40 rounded-lg text-lg font-mono font-bold text-[#0F262A] focus:outline-none focus:border-[#9A6410]"
                  />
                  <span className="text-xs font-semibold text-[#4C666A]">dias</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {[7, 15, 30, 45, 60].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDiasPrazo(d)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                        diasPrazo === d
                          ? 'bg-[#9A6410] text-white'
                          : 'bg-white border border-[#D2E0E0] text-[#4C666A] hover:border-[#9A6410]'
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-[#D2E0E0] text-[11.5px] text-[#4C666A] flex justify-between">
                <span>Período:</span>
                <strong className="font-mono text-[#0F262A]">{nf(mesesPrazo, 1)} mês(es)</strong>
              </div>
            </div>

            {/* Etapa 4: Taxa (Desconto à Vista e Juros a Prazo) */}
            <div className="lg:col-span-3 bg-[#0F262A] text-white rounded-xl p-4 flex flex-col justify-between shadow-md">
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#5CE1E6]">
                  <span>4. Taxa Resultante</span>
                  <Percent className="w-3.5 h-3.5" />
                </div>

                {/* Desconto Comercial à Vista (Principal para o Cliente) */}
                <div className="mt-2 bg-white/10 rounded-lg p-2.5 border border-white/15">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-emerald-300 font-semibold uppercase tracking-wide">
                      Desconto à Vista (p/ Cliente)
                    </span>
                    <span className="text-[11px] font-mono text-emerald-300">
                      -{brl(diferencaPorKg)}/kg
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <div className="text-2xl font-mono font-bold text-emerald-400">
                      {pct(taxaDescontoVista, 2)}
                    </div>
                    <div className="text-[11px] text-gray-300 font-mono">
                      ({pct(taxaDescontoMensal, 2)} a.m.)
                    </div>
                  </div>
                </div>

                {/* Acréscimo / Juros de À Vista -> A Prazo */}
                <div className="mt-2 bg-white/5 rounded-lg p-2.5 border border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-amber-300 font-semibold uppercase tracking-wide">
                      Juros Embutido (Vista → Prazo)
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={Number((taxaJurosPeriodo * 100).toFixed(2))}
                        onChange={(e) => handleChangeTaxaJurosPeriodo(Number(e.target.value) || 0)}
                        className="w-16 px-1.5 py-0.5 bg-white/15 border border-amber-300/40 rounded text-right font-mono text-xs font-bold text-amber-300 focus:outline-none"
                        title="Você também pode digitar a % de juros aqui para calcular o preço a prazo"
                      />
                      <span className="text-xs font-mono text-amber-300">%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-gray-300 font-mono">
                    <span>Simples: {pct(taxaJurosMensalSimples, 2)} a.m.</span>
                    <span>Comp.: {pct(taxaJurosMensalComposta, 2)} a.m.</span>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-white/15 text-[11px] text-gray-300 flex justify-between items-center">
                <span>Economia do cliente à vista:</span>
                <strong className="font-mono text-emerald-400 text-xs">{brl0(diferencaTotalCarga)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODO APRESENTAÇÃO COMERCIAL PARA O CLIENTE */}
      {modoVisualizacao === 'cliente' && (
        <div className="bg-white border-2 border-[#0B6E78] rounded-2xl shadow-lg overflow-hidden animate-in fade-in duration-150">
          <div className="bg-[#0B6E78] text-white px-6 py-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-[#DBEDEE] font-semibold">
                Proposta Comercial · SeaGO Camarões
              </div>
              <h3 className="text-xl font-bold mt-0.5">
                Condições de Fornecimento — Volume de {nf(qtdVendida, 0)} kg ({nf(caixas, 0)} caixas)
              </h3>
            </div>
            <div className="bg-white/15 px-3.5 py-1.5 rounded-full text-xs font-mono font-semibold">
              Prazo analisado: {diasPrazo} dias
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Preço A Prazo */}
            <div className="border border-[#D2E0E0] rounded-xl p-5 bg-[#F2F6F6]/60 flex flex-col justify-between">
              <div>
                <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#DDE8E8] text-[#4C666A]">
                  Opção 1 · Pagamento a Prazo ({diasPrazo} dias)
                </span>
                <div className="mt-4 text-3xl font-mono font-bold text-[#0F262A]">
                  {brl(precoPrazoKg)} <span className="text-base font-normal text-[#4C666A]">/ kg</span>
                </div>
                <p className="text-xs text-[#4C666A] mt-1">
                  Faturamento para pagamento em {diasPrazo} dias
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#D2E0E0] space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#4C666A]">Volume total:</span>
                  <span className="font-mono font-semibold">{nf(qtdVendida, 0)} kg</span>
                </div>
                <div className="flex justify-between text-base font-bold text-[#0F262A]">
                  <span>Valor Total a Prazo:</span>
                  <span className="font-mono">{brl(faturamentoPrazo)}</span>
                </div>
              </div>
            </div>

            {/* Card 2: Preço À Vista (Destaque de Desconto) */}
            <div className="border-2 border-[#0F7A55] rounded-xl p-5 bg-emerald-50/40 flex flex-col justify-between relative shadow-sm">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#0F7A55] text-white">
                    <CheckCircle2 className="w-3 h-3" />
                    Opção 2 · Pagamento à Vista
                  </span>
                  <span className="text-xs font-mono font-bold text-[#0F7A55] bg-emerald-100 px-2 py-0.5 rounded-md">
                    -{pct(taxaDescontoVista, 2)} OFF
                  </span>
                </div>
                <div className="mt-4 text-3xl font-mono font-bold text-[#0F7A55]">
                  {brl(precoVistaKg)} <span className="text-base font-normal text-[#4C666A]">/ kg</span>
                </div>
                <p className="text-xs text-[#0F7A55] font-medium mt-1">
                  Redução direta de {brl(diferencaPorKg)} por quilo no pagamento à vista
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-emerald-200 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#4C666A]">Volume total:</span>
                  <span className="font-mono font-semibold">{nf(qtdVendida, 0)} kg</span>
                </div>
                <div className="flex justify-between text-base font-bold text-[#0F7A55]">
                  <span>Valor Total à Vista:</span>
                  <span className="font-mono">{brl(faturamentoVista)}</span>
                </div>
              </div>
            </div>

            {/* Card 3: Resumo da Economia Financeira */}
            <div className="border border-[#D2E0E0] rounded-xl p-5 bg-[#0F262A] text-white flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#5CE1E6]">
                  <BadgePercent className="w-4 h-4" />
                  <span>Análise de Desconto Comercial</span>
                </div>
                <div className="mt-4">
                  <div className="text-xs text-gray-300">Taxa de desconto à vista concedida:</div>
                  <div className="text-3xl font-mono font-bold text-emerald-400 mt-0.5">
                    {pct(taxaDescontoVista, 2)}
                  </div>
                  <div className="text-xs text-gray-400 font-mono mt-0.5">
                    Equivalente a {pct(taxaDescontoMensal, 2)} ao mês ({diasPrazo} dias)
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/15 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-300">Desconto por kg:</span>
                  <span className="font-mono font-semibold text-emerald-400">
                    -{brl(diferencaPorKg)} / kg
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span className="text-white">Economia Total na Carga:</span>
                  <span className="font-mono text-emerald-400">{brl(diferencaTotalCarga)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DADOS OPERACIONAIS DA CARGA (PREENCHIMENTO NORMAL DE COMPRA E CUSTOS) */}
      <div className="bg-white border border-[#D2E0E0] rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#D2E0E0] bg-white flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-[12px] uppercase tracking-wider font-semibold text-[#7A9296]">
              Dados de Compra e Custos da Operação (Base para Cálculo de Lucro)
            </h3>
            <p className="text-xs text-[#4C666A] mt-0.5">
              Insira ou ajuste o valor de compra do camarão, volume e CIF para apurar o lucro líquido de cada modalidade.
            </p>
          </div>
          <div className="text-xs font-mono bg-[#E9F0F0] px-3 py-1.5 rounded-lg text-[#0F262A]">
            Custo Total por KG Vendido: <b className="text-[#0B6E78]">{brl(custoPorKgVendido)}/kg</b>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase text-[#7A9296] mb-1">
              Qtd Comprada (kg)
            </label>
            <input
              type="number"
              step="10"
              value={qtdComprada}
              onChange={(e) => {
                setCargaBase('LIVRE');
                setQtdComprada(Number(e.target.value) || 0);
              }}
              className="w-full p-2.5 border border-[#B6CBCB] rounded-lg text-sm font-mono bg-white focus:outline-none focus:border-[#0B6E78]"
            />
            <span className="block text-[11px] text-[#7A9296] mt-1 font-mono">
              {nf(caixas, 1)} cx → <b>{nf(qtdVendida, 1)} kg vendidos</b>
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase text-[#7A9296] mb-1">
              Compra do Camarão (R$/kg)
            </label>
            <input
              type="number"
              step="0.1"
              value={precoCompraKg}
              onChange={(e) => {
                setCargaBase('LIVRE');
                setPrecoCompraKg(Number(e.target.value) || 0);
              }}
              className="w-full p-2.5 border border-[#B6CBCB] rounded-lg text-sm font-mono bg-white focus:outline-none focus:border-[#0B6E78]"
            />
            <span className="block text-[11px] text-[#7A9296] mt-1 font-mono">
              Custo MP: <b>{brl0(custoMpTotal)}</b>
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase text-[#7A9296] mb-1">
              CIF / Custos Indiretos (R$)
            </label>
            <input
              type="number"
              step="100"
              value={cifTotalSimulado}
              onChange={(e) => {
                setCargaBase('LIVRE');
                setCifTotalSimulado(Number(e.target.value) || 0);
              }}
              className="w-full p-2.5 border border-[#B6CBCB] rounded-lg text-sm font-mono bg-white focus:outline-none focus:border-[#0B6E78]"
            />
            <span className="block text-[11px] text-[#7A9296] mt-1 font-mono">
              Rateio: <b>{brl(cifPorKgVendido)}/kg vendido</b>
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase text-[#7A9296] mb-1">
              Kg por Caixa / Enxarque
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.5"
                value={kgCaixa}
                onChange={(e) => setKgCaixa(Number(e.target.value) || 16)}
                className="w-full p-2.5 border border-[#B6CBCB] rounded-lg text-sm font-mono bg-white focus:outline-none focus:border-[#0B6E78]"
                title="Kg por caixa"
              />
              <input
                type="number"
                step="0.1"
                value={enxarqueKg}
                onChange={(e) => setEnxarqueKg(Number(e.target.value) || 0)}
                className="w-full p-2.5 border border-[#B6CBCB] rounded-lg text-sm font-mono bg-white focus:outline-none focus:border-[#0B6E78]"
                title="Enxarque kg/caixa"
              />
            </div>
            <span className="block text-[11px] text-[#7A9296] mt-1 font-mono">
              Ganho enxarque: <b>+{nf(enxarqueTotal, 0)} kg</b>
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase text-[#9A6410] mb-1">
              Custo de Capital (% a.m.)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0"
                value={custoCapitalMensalPct}
                onChange={(e) => handleChangeCustoCapitalPct(Number(e.target.value) || 0)}
                className="w-full pr-12 p-2.5 border-2 border-[#9A6410]/40 rounded-lg text-sm font-mono font-bold text-[#9A6410] bg-amber-50/30 focus:outline-none focus:border-[#9A6410]"
                title="Taxa mensal de custo de capital / antecipação para venda a prazo"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono font-semibold text-[#9A6410]">
                % a.m.
              </span>
            </div>
            <span className="block text-[11px] text-[#9A6410] mt-1 font-mono">
              Desc. Fin. ({diasPrazo}d): <b>{brl0(descontoFinanceiro)}</b>
            </span>
          </div>

          <div className="bg-[#E9F0F0] border border-[#D2E0E0] rounded-lg p-3 flex flex-col justify-center">
            <div className="text-[11px] font-semibold uppercase text-[#7A9296]">
              Investimento Total da Carga
            </div>
            <div className="text-lg font-mono font-bold text-[#A9382A] mt-0.5">
              {brl0(custoTotalOperacao)}
            </div>
            <div className="text-[11px] text-[#4C666A] font-mono mt-0.5">
              Break-even: {brl(custoPorKgVendido)}/kg
            </div>
          </div>
        </div>
      </div>

      {/* COMPARATIVO DE RESULTADO OPERACIONAL: VENDA À VISTA VS VENDA A PRAZO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Coluna 1: Resultado Operacional À VISTA */}
        <div className="bg-white border-2 border-[#0F7A55]/30 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-emerald-50/70 border-b border-[#0F7A55]/20 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F7A55]">
                Cenário 1 · Recebimento Imediato
              </span>
              <h3 className="text-base font-bold text-[#0F262A]">
                Resultado na Venda À VISTA ({brl(precoVistaKg)}/kg)
              </h3>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-white border border-[#0F7A55]/30 text-[#0F7A55]">
              Desconto cliente: {pct(taxaDescontoVista, 2)}
            </span>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <KpiCard
                label="Faturamento à Vista"
                value={brl0(faturamentoVista)}
                subtitle={`${nf(qtdVendida, 0)} kg × ${brl(precoVistaKg)}`}
              />
              <KpiCard
                label="Lucro Operacional"
                value={brl0(lucroVista)}
                subtitle={`Margem de ${pct(margemVista)}`}
                hero={true}
                valueClass={lucroVista >= 0 ? 'text-[#0F7A55]' : 'text-[#A9382A]'}
              />
              <KpiCard
                label="Lucro por kg"
                value={brl(lucroKgVista)}
                subtitle={`ROI de ${pct(roiVista)}`}
                valueClass={lucroVista >= 0 ? 'text-[#0F7A55]' : 'text-[#A9382A]'}
              />
            </div>

            <div className="bg-[#F2F6F6] rounded-xl p-4 space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#4C666A]">(+) Faturamento Bruto à Vista:</span>
                <span className="font-mono font-semibold text-[#0F262A]">{brl(faturamentoVista)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#4C666A]">(−) Custo Matéria-Prima ({nf(qtdComprada, 0)} kg):</span>
                <span className="font-mono text-[#A9382A]">− {brl(custoMpTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#4C666A]">(−) Custos Indiretos (CIF):</span>
                <span className="font-mono text-[#A9382A]">− {brl(cifTotalSimulado)}</span>
              </div>
              <div className="pt-2 border-t border-[#D2E0E0] flex justify-between font-bold text-sm">
                <span className="text-[#0F262A]">(=) Lucro Líquido da Carga (À Vista):</span>
                <span className={`font-mono ${lucroVista >= 0 ? 'text-[#0F7A55]' : 'text-[#A9382A]'}`}>
                  {brl(lucroVista)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna 2: Resultado Operacional A PRAZO */}
        <div className="bg-white border-2 border-[#0B6E78]/40 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-[#DBEDEE]/60 border-b border-[#0B6E78]/20 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0B6E78]">
                Cenário 2 · Faturamento em {diasPrazo} dias (+{brl(diferencaPorKg)}/kg)
              </span>
              <h3 className="text-base font-bold text-[#0F262A]">
                Resultado na Venda A PRAZO ({brl(precoPrazoKg)}/kg)
              </h3>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-white border border-[#0B6E78]/30 text-[#0B6E78]">
              Juros: +{pct(taxaJurosPeriodo, 2)}
            </span>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <KpiCard
                label="Faturamento a Prazo"
                value={brl0(faturamentoPrazo)}
                subtitle={`${nf(qtdVendida, 0)} kg × ${brl(precoPrazoKg)}`}
              />
              <KpiCard
                label="Lucro Operacional"
                value={brl0(lucroPrazo)}
                subtitle={`Margem de ${pct(margemPrazo)}`}
                hero={true}
                valueClass={lucroPrazo >= 0 ? 'text-[#0B6E78]' : 'text-[#A9382A]'}
              />
              <KpiCard
                label="Lucro por kg"
                value={brl(lucroKgPrazo)}
                subtitle={`ROI de ${pct(roiPrazo)}`}
                valueClass={lucroPrazo >= 0 ? 'text-[#0B6E78]' : 'text-[#A9382A]'}
              />
            </div>

            <div className="bg-[#F2F6F6] rounded-xl p-4 space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#4C666A]">(+) Faturamento Bruto a Prazo ({diasPrazo}d):</span>
                <span className="font-mono font-semibold text-[#0F262A]">{brl(faturamentoPrazo)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#4C666A]">(−) Custo Matéria-Prima ({nf(qtdComprada, 0)} kg):</span>
                <span className="font-mono text-[#A9382A]">− {brl(custoMpTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#4C666A]">(−) Custos Indiretos (CIF):</span>
                <span className="font-mono text-[#A9382A]">− {brl(cifTotalSimulado)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-amber-50/80 border border-[#9A6410]/25 rounded-lg px-2.5 py-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[#9A6410] font-semibold">
                    (−) Desconto Financeiro (Custo Capital):
                  </span>
                  <div className="inline-flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={custoCapitalMensalPct}
                      onChange={(e) => handleChangeCustoCapitalPct(Number(e.target.value) || 0)}
                      className="w-14 px-1.5 py-0.5 bg-white border border-[#9A6410]/40 rounded text-right font-mono text-xs font-bold text-[#9A6410] focus:outline-none"
                      title="Taxa de custo de capital (% ao mês)"
                    />
                    <span className="text-[11px] font-mono text-[#9A6410]">% a.m.</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[#A9382A] font-semibold">− R$</span>
                  <input
                    type="number"
                    step="50"
                    min="0"
                    value={descontoFinanceiro}
                    onChange={(e) => handleChangeDescontoFinanceiroRs(Number(e.target.value) || 0)}
                    className="w-24 px-1.5 py-0.5 bg-white border border-[#A9382A]/30 rounded text-right font-mono text-xs font-bold text-[#A9382A] focus:outline-none"
                    title="Valor em R$ do desconto financeiro / custo de capital"
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-[#D2E0E0] flex justify-between font-bold text-sm">
                <span className="text-[#0F262A]">
                  (=) Lucro Líquido da Carga (A Prazo):
                  {descontoFinanceiro > 0 && (
                    <span className="block text-[11px] font-normal text-[#7A9296]">
                      Sem desc. financeiro: {brl(lucroPrazoBruto)}
                    </span>
                  )}
                </span>
                <span className={`font-mono ${lucroPrazo >= 0 ? 'text-[#0B6E78]' : 'text-[#A9382A]'}`}>
                  {brl(lucroPrazo)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela Resumo de Indicadores Financeiros e Comerciais */}
      <div className="bg-white border border-[#D2E0E0] rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#D2E0E0] bg-white">
          <h3 className="text-[12px] uppercase tracking-wider font-semibold text-[#7A9296]">
            Quadro Comparativo Completo · Indicadores Comerciais e Operacionais
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px] border-collapse">
            <thead>
              <tr className="bg-[#F2F6F6] border-b border-[#D2E0E0] text-[11px] uppercase tracking-wider text-[#7A9296]">
                <th className="text-left py-3 px-4 font-semibold">Indicador</th>
                <th className="text-right py-3 px-4 font-semibold text-[#0F7A55]">Venda à Vista (Valor Inicial)</th>
                <th className="text-right py-3 px-4 font-semibold text-[#0B6E78]">Venda a Prazo ({diasPrazo} dias)</th>
                <th className="text-right py-3 px-4 font-semibold">Diferença / Taxa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D2E0E0]">
              <tr className="hover:bg-[#E9F0F0]/50">
                <td className="py-2.5 px-4 font-medium text-[#0F262A]">Preço de Venda por kg</td>
                <td className="py-2.5 px-4 text-right font-mono font-semibold text-[#0F7A55]">{brl(precoVistaKg)}/kg</td>
                <td className="py-2.5 px-4 text-right font-mono font-semibold text-[#0B6E78]">{brl(precoPrazoKg)}/kg</td>
                <td className="py-2.5 px-4 text-right font-mono font-semibold">
                  +{brl(diferencaPorKg)}/kg ({pct(taxaDescontoVista, 2)} desc. à vista)
                </td>
              </tr>
              <tr className="hover:bg-[#E9F0F0]/50">
                <td className="py-2.5 px-4 font-medium text-[#0F262A]">Faturamento Total ({nf(qtdVendida, 0)} kg)</td>
                <td className="py-2.5 px-4 text-right font-mono">{brl(faturamentoVista)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{brl(faturamentoPrazo)}</td>
                <td className="py-2.5 px-4 text-right font-mono text-[#0B6E78] font-semibold">+{brl(diferencaTotalCarga)}</td>
              </tr>
              <tr className="hover:bg-[#E9F0F0]/50">
                <td className="py-2.5 px-4 font-medium text-[#0F262A]">Custo Total (Camarão + CIF)</td>
                <td className="py-2.5 px-4 text-right font-mono text-[#A9382A]">{brl(custoTotalOperacao)}</td>
                <td className="py-2.5 px-4 text-right font-mono text-[#A9382A]">{brl(custoTotalOperacao)}</td>
                <td className="py-2.5 px-4 text-right font-mono text-[#7A9296]">{brl(custoPorKgVendido)}/kg vendido</td>
              </tr>
              <tr className="hover:bg-[#E9F0F0]/50 bg-amber-50/40">
                <td className="py-2.5 px-4 font-medium text-[#9A6410]">
                  (−) Desconto Financeiro / Custo de Capital ({nf(custoCapitalMensalPct, 1)}% a.m.)
                </td>
                <td className="py-2.5 px-4 text-right font-mono text-[#7A9296]">R$ 0,00</td>
                <td className="py-2.5 px-4 text-right font-mono font-semibold text-[#A9382A]">
                  − {brl(descontoFinanceiro)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono text-[#9A6410]">
                  −{brl(qtdVendida > 0 ? descontoFinanceiro / qtdVendida : 0)}/kg vendido
                </td>
              </tr>
              <tr className="hover:bg-[#E9F0F0]/50 bg-[#E9F0F0]/30 font-semibold">
                <td className="py-3 px-4 text-[#0F262A]">Lucro Operacional da Carga</td>
                <td className={`py-3 px-4 text-right font-mono ${lucroVista >= 0 ? 'text-[#0F7A55]' : 'text-[#A9382A]'}`}>
                  {brl(lucroVista)}
                </td>
                <td className={`py-3 px-4 text-right font-mono ${lucroPrazo >= 0 ? 'text-[#0B6E78]' : 'text-[#A9382A]'}`}>
                  {brl(lucroPrazo)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-[#0F7A55]">+{brl(lucroPrazo - lucroVista)}</td>
              </tr>
              <tr className="hover:bg-[#E9F0F0]/50">
                <td className="py-2.5 px-4 font-medium text-[#0F262A]">Lucro Líquido por kg Vendido</td>
                <td className="py-2.5 px-4 text-right font-mono">{brl(lucroKgVista)}/kg</td>
                <td className="py-2.5 px-4 text-right font-mono">{brl(lucroKgPrazo)}/kg</td>
                <td className="py-2.5 px-4 text-right font-mono">+{brl(lucroKgPrazo - lucroKgVista)}/kg</td>
              </tr>
              <tr className="hover:bg-[#E9F0F0]/50">
                <td className="py-2.5 px-4 font-medium text-[#0F262A]">Margem Operacional (%)</td>
                <td className="py-2.5 px-4 text-right font-mono">{pct(margemVista, 2)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{pct(margemPrazo, 2)}</td>
                <td className="py-2.5 px-4 text-right font-mono">
                  +{nf((margemPrazo - margemVista) * 100, 2)} p.p.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
