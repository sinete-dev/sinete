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
 * A NFS-e Nacional tem simulador próprio (`criarNfseSim`): Sefin Nacional (emissão síncrona, consultas, eventos) e
 * ADN (parametrização municipal), com as regras dos Anexos I e II como dado.
 */

export type {
  ConferenciaDaAssinatura,
  ConferenciaDoCertificado,
  EntradaConferenciaAssinatura,
  IdentidadeDoCertificado,
} from './certs.ts';
export { conferirAssinaturaDoDocumento, conferirTransmissor } from './certs.ts';
export type {
  AtivacaoSvc,
  ConfiguracaoSim,
  ContextoDoPedido,
  EstadoDeExecucao,
  ProtocoloSemDigVal,
  Svc,
} from './context.ts';
export type { TratadorSim } from './handler.ts';
export type { ParametrosDoMotivo } from './messages.ts';
export { ehDenegacao, ehResultado, motivo, motivoMdfe, motivoRejeicao } from './messages.ts';
export type {
  AliquotaSim,
  AliquotasIbsCbsSim,
  ContribuinteNfseSim,
  MunicipioSim,
  NfseSimOpcoes,
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
export type { AlvoDaFalhaNfseSim, InspecaoNfseSim, NfseRota, NfseSim, NfseSimOpcoesCompletas } from './nfse/sim.ts';
export { criarNfseSim, NFSE_SIM_PREFIXOS } from './nfse/sim.ts';
export { redirecionarNfseParaSim } from './nfse/transport.ts';
export type { PfxSinteticoOpcoes } from './pfx.ts';
export { pfxSintetico } from './pfx.ts';
export type {
  ContextoAutorizacao,
  ContextoEvento,
  ContextoInutilizacao,
  FatosEvento,
  FatosInutilizacao,
  FatosNfe,
  RegraSim,
  RegrasSim,
  RejeicaoSim,
  VisaoSim,
} from './rules.ts';
export { primeiraRejeicao, REGRAS_PADRAO, rejeicaoDaChave } from './rules.ts';
export type { AutorizadorSim, DefinicaoDeServico, MdfeServicoSim, ServicoSim } from './services.ts';
export {
  acaoSoap,
  caminhoDoServico,
  definicaoDoServico,
  ehServicoMdfe,
  MDFE_NS,
  NFE_NS,
  namespaceDoWsdl,
  rotaDe,
  SERVICOS_MDFE,
  SERVICOS_NFE,
} from './services.ts';
export type {
  AlvoDaFalha,
  EfeitoSim,
  FalhaSim,
  InspecaoSim,
  PedidoSim,
  RespostaSim,
  SefazSim,
  SefazSimOpcoes,
} from './sim.ts';
export { criarSefazSim } from './sim.ts';
export type {
  Contribuinte,
  Documento,
  DocumentoDaDistribuicao,
  NfePendente,
  RegistroEvento,
  RegistroEventoMdfe,
  RegistroInutilizacao,
  RegistroLote,
  RegistroMdfe,
  RegistroNfe,
  SituacaoMdfe,
  SituacaoNfe,
} from './state.ts';
export type { CertificadoSintetico, CertificadoSinteticoOpcoes, PapelSintetico } from './synthetic.ts';
export { certificadoSintetico } from './synthetic.ts';
export type { TransporteSimOpcoes } from './transport.ts';
export { autorizadorSimDe, redirecionarParaSim, transporteSim, URL_BASE_SIM } from './transport.ts';
