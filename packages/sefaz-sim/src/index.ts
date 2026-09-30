/**
 * `@sinete/sefaz-sim`: SEFAZ simulada com estado, para testes.
 *
 * Web services da NF-e 4.00 (autorização síncrona e assíncrona, retorno do recibo, consulta de protocolo, eventos de
 * cancelamento, cancelamento por substituição, carta de correção e manifestação do destinatário, inutilização,
 * consulta cadastro, distribuição de DF-e) com as validações do MOC 7.0 na ordem da SEFAZ; e os do MDF-e 3.00 na SVRS
 * (recepção síncrona, consulta, não encerrados, status e eventos de cancelamento, encerramento, inclusão de condutor e
 * de DF-e e pagamento da operação), com as regras do MOC do MDF-e, relógio injetado, números
 * determinísticos e cenários de falha. Esta entrada roda em qualquer runtime (o simulador em processo e o `Transporte`
 * sem socket); a entrada `node` acrescenta o servidor HTTPS com mTLS.
 *
 * A NFS-e Nacional tem simulador próprio (`createNfseSim`): Sefin Nacional (emissão síncrona, consultas, eventos) e
 * ADN (parametrização municipal), com as regras dos Anexos I e II como dado.
 */

export type { CertCheck, CertIdentity, SignatureCheck, SignatureCheckInput } from './certs.ts';
export { checkAssinatura, checkTransmissor } from './certs.ts';
export type { AtivacaoSvc, ProtocoloSemDigVal, RequestContext, Runtime, SimConfig, Svc } from './context.ts';
export type { SimHandler } from './handler.ts';
export type { MotivoParams } from './messages.ts';
export { isDenegacao, isResultado, motivo, motivoMdfe, motivoRejeicao } from './messages.ts';
export type {
  AliquotaSim,
  AliquotasIbsCbsSim,
  ContribuinteNfseSim,
  MunicipioSim,
  NfseSimOptions,
  ServicoMunicipalSim,
} from './nfse/dados.ts';
export { dvChave } from './nfse/documentos.ts';
export type {
  DpsFatos,
  EventoNfseFatos,
  EventoNfseRegistro,
  NfseRegistro,
  NfseSimRegra,
  NfseSimRegras,
} from './nfse/regras.ts';
export { NFSE_REGRAS_PADRAO } from './nfse/regras.ts';
export type { NfseRota, NfseSim, NfseSimFaultTarget, NfseSimFullOptions, NfseSimInspect } from './nfse/sim.ts';
export { createNfseSim, NFSE_SIM_PREFIXOS } from './nfse/sim.ts';
export { redirectNfseToSim } from './nfse/transport.ts';
export type { SyntheticPfxOptions } from './pfx.ts';
export { syntheticPfx } from './pfx.ts';
export type {
  AutorizacaoContext,
  EventoContext,
  EventoFacts,
  InutilizacaoContext,
  InutilizacaoFacts,
  NfeFacts,
  SimRejection,
  SimRule,
  SimRules,
  SimView,
} from './rules.ts';
export { chaveRejection, DEFAULT_RULES, firstRejection } from './rules.ts';
export type { MdfeServicoSim, ServiceDef, SimAutorizador, SimServico } from './services.ts';
export {
  isMdfeServico,
  MDFE_NS,
  MDFE_SERVICES,
  NFE_NS,
  NFE_SERVICES,
  routeOf,
  serviceDef,
  servicePath,
  soapAction,
  wsdlNamespace,
} from './services.ts';
export type {
  FaultTarget,
  SefazSim,
  SefazSimOptions,
  SimEffect,
  SimFault,
  SimInspect,
  SimRequest,
  SimResult,
} from './sim.ts';
export { createSefazSim } from './sim.ts';
export type {
  Contribuinte,
  DistDoc,
  Documento,
  EventoRecord,
  InutilizacaoRecord,
  LoteRecord,
  MdfeEventoRecord,
  MdfeRecord,
  NfeRecord,
  PendingNfe,
  SituacaoMdfe,
  SituacaoNfe,
} from './state.ts';
export type { SyntheticCertificate, SyntheticCertificateOptions, SyntheticRole } from './synthetic.ts';
export { syntheticCertificate } from './synthetic.ts';
export type { SimTransportOptions } from './transport.ts';
export { redirectToSim, SIM_BASE_URL, simAutorizadorOf, simTransport } from './transport.ts';
