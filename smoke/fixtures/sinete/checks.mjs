// Verificações do guarda-chuva `sinete` compartilhadas por Node, Bun, Deno e Chromium: cada subpath `sinete/x`
// reexporta exatamente os mesmos objetos de `@sinete/x` (mesma função, mesma classe), sem cópia. Devolve as falhas.
// Lista de subpaths igual ao `exports` do packages/sinete/package.json (gerado por scripts/umbrella.ts).
import * as m_u_cert from 'sinete/cert';
import * as m_p_cert from '@sinete/cert';
import * as m_u_core from 'sinete/core';
import * as m_p_core from '@sinete/core';
import * as m_u_core_xml from 'sinete/core/xml';
import * as m_p_core_xml from '@sinete/core/xml';
import * as m_u_da from 'sinete/da';
import * as m_p_da from '@sinete/da';
import * as m_u_da_cce from 'sinete/da/cce';
import * as m_p_da_cce from '@sinete/da/cce';
import * as m_u_da_mdfe from 'sinete/da/mdfe';
import * as m_p_da_mdfe from '@sinete/da/mdfe';
import * as m_u_da_nfce from 'sinete/da/nfce';
import * as m_p_da_nfce from '@sinete/da/nfce';
import * as m_u_da_nfe from 'sinete/da/nfe';
import * as m_p_da_nfe from '@sinete/da/nfe';
import * as m_u_da_nfse from 'sinete/da/nfse';
import * as m_p_da_nfse from '@sinete/da/nfse';
import * as m_u_emissor from 'sinete/emissor';
import * as m_p_emissor from '@sinete/emissor';
import * as m_u_emissor_contrato from 'sinete/emissor/contrato';
import * as m_p_emissor_contrato from '@sinete/emissor/contrato';
import * as m_u_emissor_mdfe from 'sinete/emissor/mdfe';
import * as m_p_emissor_mdfe from '@sinete/emissor/mdfe';
import * as m_u_emissor_memoria from 'sinete/emissor/memoria';
import * as m_p_emissor_memoria from '@sinete/emissor/memoria';
import * as m_u_emissor_nfe from 'sinete/emissor/nfe';
import * as m_p_emissor_nfe from '@sinete/emissor/nfe';
import * as m_u_emissor_nfse from 'sinete/emissor/nfse';
import * as m_p_emissor_nfse from '@sinete/emissor/nfse';
import * as m_u_ibs_cbs from 'sinete/ibs-cbs';
import * as m_p_ibs_cbs from '@sinete/ibs-cbs';
import * as m_u_ibs_cbs_dados from 'sinete/ibs-cbs-dados';
import * as m_p_ibs_cbs_dados from '@sinete/ibs-cbs-dados';
import * as m_u_ibs_cbs_dados_bundled from 'sinete/ibs-cbs-dados/bundled';
import * as m_p_ibs_cbs_dados_bundled from '@sinete/ibs-cbs-dados/bundled';
import * as m_u_ibs_cbs_aliquotas from 'sinete/ibs-cbs/aliquotas';
import * as m_p_ibs_cbs_aliquotas from '@sinete/ibs-cbs/aliquotas';
import * as m_u_ibs_cbs_calcular from 'sinete/ibs-cbs/calcular';
import * as m_p_ibs_cbs_calcular from '@sinete/ibs-cbs/calcular';
import * as m_u_ibs_cbs_determinar from 'sinete/ibs-cbs/determinar';
import * as m_p_ibs_cbs_determinar from '@sinete/ibs-cbs/determinar';
import * as m_u_ibs_cbs_validar from 'sinete/ibs-cbs/validar';
import * as m_p_ibs_cbs_validar from '@sinete/ibs-cbs/validar';
import * as m_u_mdfe from 'sinete/mdfe';
import * as m_p_mdfe from '@sinete/mdfe';
import * as m_u_nfe from 'sinete/nfe';
import * as m_p_nfe from '@sinete/nfe';
import * as m_u_nfe_ibs_cbs from 'sinete/nfe/ibs-cbs';
import * as m_p_nfe_ibs_cbs from '@sinete/nfe/ibs-cbs';
import * as m_u_nfse from 'sinete/nfse';
import * as m_p_nfse from '@sinete/nfse';
import * as m_u_rejeicoes from 'sinete/rejeicoes';
import * as m_p_rejeicoes from '@sinete/rejeicoes';
import * as m_u_rejeicoes_mdfe from 'sinete/rejeicoes/mdfe';
import * as m_p_rejeicoes_mdfe from '@sinete/rejeicoes/mdfe';
import * as m_u_rejeicoes_nfse from 'sinete/rejeicoes/nfse';
import * as m_p_rejeicoes_nfse from '@sinete/rejeicoes/nfse';
import * as m_u_schemas from 'sinete/schemas';
import * as m_p_schemas from '@sinete/schemas';
import * as m_u_schemas_mdfe_3_00b from 'sinete/schemas/mdfe/3.00b';
import * as m_p_schemas_mdfe_3_00b from '@sinete/schemas/mdfe/3.00b';
import * as m_u_schemas_mdfe_eventos_3_00b from 'sinete/schemas/mdfe/eventos/3.00b';
import * as m_p_schemas_mdfe_eventos_3_00b from '@sinete/schemas/mdfe/eventos/3.00b';
import * as m_u_schemas_mdfe_servicos_3_00b from 'sinete/schemas/mdfe/servicos/3.00b';
import * as m_p_schemas_mdfe_servicos_3_00b from '@sinete/schemas/mdfe/servicos/3.00b';
import * as m_u_schemas_nfe_PL_010e from 'sinete/schemas/nfe/PL_010e';
import * as m_p_schemas_nfe_PL_010e from '@sinete/schemas/nfe/PL_010e';
import * as m_u_schemas_nfe_PL_010f from 'sinete/schemas/nfe/PL_010f';
import * as m_p_schemas_nfe_PL_010f from '@sinete/schemas/nfe/PL_010f';
import * as m_u_schemas_nfe_consulta_cadastro_PL_010d from 'sinete/schemas/nfe/consulta-cadastro/PL_010d';
import * as m_p_schemas_nfe_consulta_cadastro_PL_010d from '@sinete/schemas/nfe/consulta-cadastro/PL_010d';
import * as m_u_schemas_nfe_consulta_protocolo_PL_010d from 'sinete/schemas/nfe/consulta-protocolo/PL_010d';
import * as m_p_schemas_nfe_consulta_protocolo_PL_010d from '@sinete/schemas/nfe/consulta-protocolo/PL_010d';
import * as m_u_schemas_nfe_dist_dfe_PL_NFeDistDFe_104 from 'sinete/schemas/nfe/dist-dfe/PL_NFeDistDFe_104';
import * as m_p_schemas_nfe_dist_dfe_PL_NFeDistDFe_104 from '@sinete/schemas/nfe/dist-dfe/PL_NFeDistDFe_104';
import * as m_u_schemas_nfe_evento_cancelamento_substituicao_PL_010d from 'sinete/schemas/nfe/evento-cancelamento-substituicao/PL_010d';
import * as m_p_schemas_nfe_evento_cancelamento_substituicao_PL_010d from '@sinete/schemas/nfe/evento-cancelamento-substituicao/PL_010d';
import * as m_u_schemas_nfe_evento_cancelamento_PL_010d from 'sinete/schemas/nfe/evento-cancelamento/PL_010d';
import * as m_p_schemas_nfe_evento_cancelamento_PL_010d from '@sinete/schemas/nfe/evento-cancelamento/PL_010d';
import * as m_u_schemas_nfe_evento_cce_PL_010d from 'sinete/schemas/nfe/evento-cce/PL_010d';
import * as m_p_schemas_nfe_evento_cce_PL_010d from '@sinete/schemas/nfe/evento-cce/PL_010d';
import * as m_u_schemas_nfe_evento_ciencia_operacao_PL_010d from 'sinete/schemas/nfe/evento-ciencia-operacao/PL_010d';
import * as m_p_schemas_nfe_evento_ciencia_operacao_PL_010d from '@sinete/schemas/nfe/evento-ciencia-operacao/PL_010d';
import * as m_u_schemas_nfe_evento_confirmacao_operacao_PL_010d from 'sinete/schemas/nfe/evento-confirmacao-operacao/PL_010d';
import * as m_p_schemas_nfe_evento_confirmacao_operacao_PL_010d from '@sinete/schemas/nfe/evento-confirmacao-operacao/PL_010d';
import * as m_u_schemas_nfe_evento_desconhecimento_operacao_PL_010d from 'sinete/schemas/nfe/evento-desconhecimento-operacao/PL_010d';
import * as m_p_schemas_nfe_evento_desconhecimento_operacao_PL_010d from '@sinete/schemas/nfe/evento-desconhecimento-operacao/PL_010d';
import * as m_u_schemas_nfe_evento_operacao_nao_realizada_PL_010d from 'sinete/schemas/nfe/evento-operacao-nao-realizada/PL_010d';
import * as m_p_schemas_nfe_evento_operacao_nao_realizada_PL_010d from '@sinete/schemas/nfe/evento-operacao-nao-realizada/PL_010d';
import * as m_u_schemas_nfe_inutilizacao_PL_010d from 'sinete/schemas/nfe/inutilizacao/PL_010d';
import * as m_p_schemas_nfe_inutilizacao_PL_010d from '@sinete/schemas/nfe/inutilizacao/PL_010d';
import * as m_u_schemas_nfe_status_servico_PL_009q from 'sinete/schemas/nfe/status-servico/PL_009q';
import * as m_p_schemas_nfe_status_servico_PL_009q from '@sinete/schemas/nfe/status-servico/PL_009q';
import * as m_u_schemas_nfse_1_01_20260209 from 'sinete/schemas/nfse/1.01-20260209';
import * as m_p_schemas_nfse_1_01_20260209 from '@sinete/schemas/nfse/1.01-20260209';
import * as m_u_schemas_nfse_1_01_20260727 from 'sinete/schemas/nfse/1.01-20260727';
import * as m_p_schemas_nfse_1_01_20260727 from '@sinete/schemas/nfse/1.01-20260727';
import * as m_u_transport from 'sinete/transport';
import * as m_p_transport from '@sinete/transport';
import * as m_u_transport_signer from 'sinete/transport/signer';
import * as m_p_transport_signer from '@sinete/transport/signer';
import * as m_u_validators from 'sinete/validators';
import * as m_p_validators from '@sinete/validators';

const PARES = [
  ['cert', m_u_cert, m_p_cert],
  ['core', m_u_core, m_p_core],
  ['core/xml', m_u_core_xml, m_p_core_xml],
  ['da', m_u_da, m_p_da],
  ['da/cce', m_u_da_cce, m_p_da_cce],
  ['da/mdfe', m_u_da_mdfe, m_p_da_mdfe],
  ['da/nfce', m_u_da_nfce, m_p_da_nfce],
  ['da/nfe', m_u_da_nfe, m_p_da_nfe],
  ['da/nfse', m_u_da_nfse, m_p_da_nfse],
  ['emissor', m_u_emissor, m_p_emissor],
  ['emissor/contrato', m_u_emissor_contrato, m_p_emissor_contrato],
  ['emissor/mdfe', m_u_emissor_mdfe, m_p_emissor_mdfe],
  ['emissor/memoria', m_u_emissor_memoria, m_p_emissor_memoria],
  ['emissor/nfe', m_u_emissor_nfe, m_p_emissor_nfe],
  ['emissor/nfse', m_u_emissor_nfse, m_p_emissor_nfse],
  ['ibs-cbs', m_u_ibs_cbs, m_p_ibs_cbs],
  ['ibs-cbs-dados', m_u_ibs_cbs_dados, m_p_ibs_cbs_dados],
  ['ibs-cbs-dados/bundled', m_u_ibs_cbs_dados_bundled, m_p_ibs_cbs_dados_bundled],
  ['ibs-cbs/aliquotas', m_u_ibs_cbs_aliquotas, m_p_ibs_cbs_aliquotas],
  ['ibs-cbs/calcular', m_u_ibs_cbs_calcular, m_p_ibs_cbs_calcular],
  ['ibs-cbs/determinar', m_u_ibs_cbs_determinar, m_p_ibs_cbs_determinar],
  ['ibs-cbs/validar', m_u_ibs_cbs_validar, m_p_ibs_cbs_validar],
  ['mdfe', m_u_mdfe, m_p_mdfe],
  ['nfe', m_u_nfe, m_p_nfe],
  ['nfe/ibs-cbs', m_u_nfe_ibs_cbs, m_p_nfe_ibs_cbs],
  ['nfse', m_u_nfse, m_p_nfse],
  ['rejeicoes', m_u_rejeicoes, m_p_rejeicoes],
  ['rejeicoes/mdfe', m_u_rejeicoes_mdfe, m_p_rejeicoes_mdfe],
  ['rejeicoes/nfse', m_u_rejeicoes_nfse, m_p_rejeicoes_nfse],
  ['schemas', m_u_schemas, m_p_schemas],
  ['schemas/mdfe/3.00b', m_u_schemas_mdfe_3_00b, m_p_schemas_mdfe_3_00b],
  ['schemas/mdfe/eventos/3.00b', m_u_schemas_mdfe_eventos_3_00b, m_p_schemas_mdfe_eventos_3_00b],
  ['schemas/mdfe/servicos/3.00b', m_u_schemas_mdfe_servicos_3_00b, m_p_schemas_mdfe_servicos_3_00b],
  ['schemas/nfe/PL_010e', m_u_schemas_nfe_PL_010e, m_p_schemas_nfe_PL_010e],
  ['schemas/nfe/PL_010f', m_u_schemas_nfe_PL_010f, m_p_schemas_nfe_PL_010f],
  ['schemas/nfe/consulta-cadastro/PL_010d', m_u_schemas_nfe_consulta_cadastro_PL_010d, m_p_schemas_nfe_consulta_cadastro_PL_010d],
  ['schemas/nfe/consulta-protocolo/PL_010d', m_u_schemas_nfe_consulta_protocolo_PL_010d, m_p_schemas_nfe_consulta_protocolo_PL_010d],
  ['schemas/nfe/dist-dfe/PL_NFeDistDFe_104', m_u_schemas_nfe_dist_dfe_PL_NFeDistDFe_104, m_p_schemas_nfe_dist_dfe_PL_NFeDistDFe_104],
  ['schemas/nfe/evento-cancelamento-substituicao/PL_010d', m_u_schemas_nfe_evento_cancelamento_substituicao_PL_010d, m_p_schemas_nfe_evento_cancelamento_substituicao_PL_010d],
  ['schemas/nfe/evento-cancelamento/PL_010d', m_u_schemas_nfe_evento_cancelamento_PL_010d, m_p_schemas_nfe_evento_cancelamento_PL_010d],
  ['schemas/nfe/evento-cce/PL_010d', m_u_schemas_nfe_evento_cce_PL_010d, m_p_schemas_nfe_evento_cce_PL_010d],
  ['schemas/nfe/evento-ciencia-operacao/PL_010d', m_u_schemas_nfe_evento_ciencia_operacao_PL_010d, m_p_schemas_nfe_evento_ciencia_operacao_PL_010d],
  ['schemas/nfe/evento-confirmacao-operacao/PL_010d', m_u_schemas_nfe_evento_confirmacao_operacao_PL_010d, m_p_schemas_nfe_evento_confirmacao_operacao_PL_010d],
  ['schemas/nfe/evento-desconhecimento-operacao/PL_010d', m_u_schemas_nfe_evento_desconhecimento_operacao_PL_010d, m_p_schemas_nfe_evento_desconhecimento_operacao_PL_010d],
  ['schemas/nfe/evento-operacao-nao-realizada/PL_010d', m_u_schemas_nfe_evento_operacao_nao_realizada_PL_010d, m_p_schemas_nfe_evento_operacao_nao_realizada_PL_010d],
  ['schemas/nfe/inutilizacao/PL_010d', m_u_schemas_nfe_inutilizacao_PL_010d, m_p_schemas_nfe_inutilizacao_PL_010d],
  ['schemas/nfe/status-servico/PL_009q', m_u_schemas_nfe_status_servico_PL_009q, m_p_schemas_nfe_status_servico_PL_009q],
  ['schemas/nfse/1.01-20260209', m_u_schemas_nfse_1_01_20260209, m_p_schemas_nfse_1_01_20260209],
  ['schemas/nfse/1.01-20260727', m_u_schemas_nfse_1_01_20260727, m_p_schemas_nfse_1_01_20260727],
  ['transport', m_u_transport, m_p_transport],
  ['transport/signer', m_u_transport_signer, m_p_transport_signer],
  ['validators', m_u_validators, m_p_validators],
];

export async function runChecks() {
  const failures = [];
  for (const [nome, guardaChuva, pacote] of PARES) {
    const chaves = Object.keys(pacote);
    if (chaves.length === 0) failures.push(`@sinete/${nome} sem exports`);
    for (const k of chaves) if (guardaChuva[k] !== pacote[k]) failures.push(`sinete/${nome}.${k} não é o de @sinete/${nome}`);
    for (const k of Object.keys(guardaChuva)) if (!(k in pacote)) failures.push(`sinete/${nome}.${k} sobrando`);
  }
  // Um uso de ponta a ponta pelo guarda-chuva: IBS/CBS e documento auxiliar.
  const { officialRates } = m_u_ibs_cbs_aliquotas;
  if (officialRates().nominal('2026-10-10').CBS.value !== '0.9') failures.push('sinete/ibs-cbs/aliquotas');
  if (typeof m_u_da_mdfe.damdfe !== 'function' || m_u_da_mdfe.toPdf !== m_u_da.toPdf) failures.push('sinete/da/mdfe');
  return failures;
}
