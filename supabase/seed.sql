-- ==============================================================================
-- SISTEMA SEAGO PRECIFICAÇÃO - SEED INICIAL (CARGAS 1 A 6 ATUALIZADAS)
-- ==============================================================================

-- 1. Parâmetros Padrão
INSERT INTO public.parametros (kg_caixa, enxarque_kg)
VALUES (16.0, 1.0)
ON CONFLICT DO NOTHING;

-- 2. Cargas Iniciais
INSERT INTO public.cargas (id, numero, data_operacao, status, observacoes) VALUES
('c1000000-0000-0000-0000-000000000001', 1, '2025-11-26', 'fechada', 'Carga 1 - Histórico'),
('c1000000-0000-0000-0000-000000000002', 2, '2025-12-05', 'fechada', 'Carga 2 - Histórico'),
('c1000000-0000-0000-0000-000000000003', 3, '2025-12-12', 'fechada', 'Carga 3 - Histórico'),
('c1000000-0000-0000-0000-000000000004', 4, '2026-01-10', 'fechada', 'Carga 4 - Histórico'),
('c1000000-0000-0000-0000-000000000005', 5, '2026-01-13', 'fechada', 'Carga 5 - Histórico'),
('c1000000-0000-0000-0000-000000000006', 6, '2026-09-07', 'fechada', 'Carga 6 - Histórico')
ON CONFLICT (numero) DO UPDATE SET data_operacao = EXCLUDED.data_operacao;

-- 3. Lotes de Matéria-Prima
INSERT INTO public.lotes (carga_id, numero_lote, data, fornecedor, classificacao, gr_inicial, gr_final, valor_compra_kg, qtd_comprada, qtd_final_medida, valor_venda_kg) VALUES
-- Carga 1
('c1000000-0000-0000-0000-000000000001', 1, '2025-11-26', 'AGROVAC', 'Camarão 60/70', 15.0, 16.0, 23.6607, 6075.0, 6664.0, 26.5),
('c1000000-0000-0000-0000-000000000001', 2, '2025-11-26', 'AQUISA', 'Camarão 100/110', 9.52, 9.52, 21.0, 1271.0, 1394.0, 26.0),
-- Carga 2
('c1000000-0000-0000-0000-000000000002', 1, '2025-12-05', 'AQUISA', 'Camarão 80/90', 10.7084, 11.5767, 23.3, 9348.0, 9949.5, 27.0),
-- Carga 3
('c1000000-0000-0000-0000-000000000003', 1, '2025-12-12', 'AGROVAC', 'Camarão 60/70', 14.5177, 15.5339, 25.0, 6742.5, 7177.5, 29.0),
('c1000000-0000-0000-0000-000000000003', 2, '2025-12-12', 'AGROVAC', 'Camarão 50/60', 16.7, 17.869, 27.0, 2232.0, 2376.0, 31.0),
-- Carga 4
('c1000000-0000-0000-0000-000000000004', 1, '2026-01-10', 'AGROVAC', 'Camarão 40/50', 19.2749, 21.2766, 29.0, 6060.5, 6647.0, 31.0),
('c1000000-0000-0000-0000-000000000004', 2, '2026-01-10', 'AGROVAC', 'Camarão 70/80', 11.1560, 12.9870, 23.5085, 3627.0, 3978.0, 27.0),
-- Carga 5
('c1000000-0000-0000-0000-000000000005', 1, '2026-01-13', 'AQUISA', 'Camarão 70/80', 11.8286, 12.5856, 24.3218, 11656.0, 12408.0, 27.0),
-- Carga 6
('c1000000-0000-0000-0000-000000000006', 1, '2026-09-07', '', '80_100', NULL, NULL, 23.0, 11200.0, NULL, 26.5)
ON CONFLICT (carga_id, numero_lote) DO UPDATE SET
    data = EXCLUDED.data,
    fornecedor = EXCLUDED.fornecedor,
    classificacao = EXCLUDED.classificacao,
    valor_compra_kg = EXCLUDED.valor_compra_kg,
    qtd_comprada = EXCLUDED.qtd_comprada,
    qtd_final_medida = EXCLUDED.qtd_final_medida,
    valor_venda_kg = EXCLUDED.valor_venda_kg;

-- 4. Lançamentos CIF para Carga 6 atualizados
DELETE FROM public.cif_lancamentos WHERE carga_id = 'c1000000-0000-0000-0000-000000000006';

INSERT INTO public.cif_lancamentos (carga_id, data, tipo_custo, qtd, valor_unitario) VALUES
('c1000000-0000-0000-0000-000000000006', '2026-07-27', '1 - Frete - externo', 1.0, 20000.0),
('c1000000-0000-0000-0000-000000000006', '2026-07-27', '3 - Frete - caixas', 700.0, 5.0),
('c1000000-0000-0000-0000-000000000006', '2026-07-27', '4 - Gelo Pesca', 20000.0, 0.22),
('c1000000-0000-0000-0000-000000000006', '2026-07-27', '5 - Metabissulfito', 2.0, 147.0),
('c1000000-0000-0000-0000-000000000006', '2026-07-27', '7 - Comissão Comprador', 1.0, 2500.0),
('c1000000-0000-0000-0000-000000000006', '2026-07-27', '6 - Comissão vendedor', 11900.0, 0.0),
('c1000000-0000-0000-0000-000000000006', '2026-07-27', '9 - Seguro', 1.0, 3380.0),
('c1000000-0000-0000-0000-000000000006', '2026-07-27', '10 - ICMS de Frete', 1.0, 3431.0),
('c1000000-0000-0000-0000-000000000006', '2026-07-27', '12 - Custo de despesca', 1.0, 300.0);
