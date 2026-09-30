# Como emitir e encerrar um MDF-e

O MDF-e (Manifesto Eletrônico de Documentos Fiscais, modelo 58, leiaute 3.00b) reúne os documentos fiscais da carga. No transporte rodoviário, é autorizado antes da viagem e encerrado na chegada, uma etapa que não existe no ciclo da NF-e (Nota Fiscal Eletrônica). Um MDF-e autorizado e não encerrado pode bloquear novas autorizações, conforme a placa, o tipo de emitente, as UFs da viagem e o tempo em aberto. As regras F85 a F88 do Manual de Orientação do Contribuinte (MOC MDF-e 3.00b) incluem as rejeições 611, 662 e 686. O sinete cobre a carga própria (emitente que não é transportador, inclusive produtor rural com certificado e-CPF) e o prestador de serviço de transporte, somente no modal rodoviário.

## Emitir

O emissor de MDF-e grava os bytes do XML assinado no `store`, o armazenamento usado para recuperar uma emissão interrompida, antes de enviar à Secretaria da Fazenda (SEFAZ). Se a resposta se perder, consulta a chave de acesso para verificar a situação do documento. Quando a autorização é confirmada, chama `aoDecidir` com o desfecho, cujo campo `proc` contém o `mdfeProc`: o XML do MDF-e com o protocolo de autorização.

No exemplo, `pfx` e `senha` são os dados do certificado, `store` é o armazenamento configurado e `aoDecidir` é a função responsável por guardar o documento decidido. Os dados do emitente e do condutor devem vir do cadastro da aplicação, e `chaveDaNfeTransportada` é a chave da NF-e da carga.

```ts
import { criarEmissorMdfe } from 'sinete/emissor/mdfe';
import type { DadosMdfe } from 'sinete/mdfe';

declare const cpfEmitente: string;
declare const nomeEmitente: string;
declare const cpfCondutor: string;
declare const nomeCondutor: string;

const emissor = await criarEmissorMdfe({ pfx, senha, ambiente: 'homologacao', store, aoDecidir });

const mdfe: DadosMdfe = {
  tpEmit: '2', // carga própria
  serie: 920, // série de emitente pessoa física
  nMDF: 1,
  emitente: {
    CPF: cpfEmitente,
    IE: '00130000019',
    xNome: nomeEmitente,
    endereco: { xLgr: 'RODOVIA DE TESTE', nro: 'KM 10', xBairro: 'ZONA RURAL', cMun: '5103403', xMun: 'CUIABA', UF: 'MT' },
  },
  ufIni: 'MT',
  ufFim: 'SP',
  percurso: ['MS'],
  carregamento: [{ cMun: '5103403', xMun: 'CUIABA' }],
  rodoviario: {
    tracao: {
      placa: 'ABC1D23',
      tara: 10000,
      capKG: 30000,
      condutores: [{ xNome: nomeCondutor, CPF: cpfCondutor }],
      tpRod: '01',
      tpCar: '03',
      UF: 'MT',
    },
  },
  descarregamentos: [{ cMun: '3550308', xMun: 'SAO PAULO', nfe: [{ chave: chaveDaNfeTransportada }] }],
  produtoPredominante: { tpCarga: '01', xProd: 'SOJA EM GRAOS', NCM: '12019000' },
  totais: { vCarga: '150000', cUnid: '01', qCarga: '30000' },
};

const d = await emissor.emitir('viagem-7', mdfe);
if (d.tipo === 'autorizado') console.log(d.id, d.protocolo.nProt);
```

- **Percurso.** O `percurso` lista as unidades federativas (UFs) atravessadas entre a de início e a de fim, na ordem da viagem. Cada trecho deve ligar UFs vizinhas (regra F90, rejeição 663). A montagem confere o percurso contra a tabela de divisas do IBGE e, quando encontra um trecho inválido, sugere um percurso com o menor número de UFs intermediárias. A rota informada deve corresponder à viagem real. Trechos que envolvem `EX` (exterior) não são conferidos. As funções `conferirPercurso` e `sugerirPercurso`, exportadas por `sinete/mdfe`, também podem ser usadas na interface da aplicação.
- **Documentos.** Cada descarregamento leva as chaves das NF-e ou dos CT-e (Conhecimentos de Transporte Eletrônicos) da carga. A montagem recusa chaves cujo ano e mês sejam anteriores ao limite de seis meses em relação à emissão do MDF-e (Nota Técnica 2024.001, rejeições 518 e 519).
- **Prazo.** Na emissão normal, o MDF-e deve ser transmitido em até 24 horas após a data e hora de emissão. Depois desse prazo, a SEFAZ pode retornar a rejeição 228 (regra F80).
- Os montadores verificam as regras do Anexo I do MOC que podem ser conferidas sem consultar o banco da SEFAZ. Nome e código do município não são cruzados com o cadastro do IBGE; as verificações correspondentes às rejeições 405, 406 e 408 ficam para a SEFAZ.

## Encerrar na chegada

```ts
import { criarEmissorMdfe } from 'sinete/emissor/mdfe';

const emissor = await criarEmissorMdfe({ pfx, senha, ambiente: 'homologacao', store, aoDecidir });
const r = await emissor.encerrar({ chave, nProt, uf: 'SP', cMun: '3550308' });
if (r.tipo === 'registrado') await guardarEvento(chave, r.procEvento);
else if (r.tipo === 'recusado') console.log(r.cStat, r.xMotivo, r.dica);
else agendarNovaTentativa(chave, r.motivo);
```

- `nProt` é o protocolo de autorização (`desfecho.protocolo.nProt` quando `emitir` retorna `tipo: 'autorizado'`). `dtEnc` é a data de encerramento e é opcional: o padrão é a data de hoje no fuso da UF da chave. Se registrar o encerramento depois da chegada, informe a data real.
- O município deve pertencer à UF informada (regras K03 e K04). Antes do envio, o cliente confere se os dois primeiros dígitos de `cMun` correspondem à UF. Para encerramento no exterior, use `uf: 'EX'` com `cMun: '9999999'`.
- **Encerramento por terceiro.** O proprietário do veículo de tração, quando não é o emitente, pode encerrar com o próprio certificado: passe `terceiro` com o CNPJ ou CPF dele e use um emissor criado com o certificado dele (Nota Técnica 2024.001, regras HP07 e K11).
- O retorno é um `DesfechoEvento`, o mesmo do `cancelar`: `registrado` traz o `evento` e o `procEvento` (o XML do evento com o retorno do registro), que a função `guardarEvento` do exemplo deve persistir; `recusado` traz `cStat`, `xMotivo` e, quando o catálogo tem, a `dica`; `pendente` diz que ainda não se sabe se a SEFAZ registrou o encerramento.
- **Resposta perdida.** Sem resposta, ou com a rejeição 631 (duplicidade de evento), o emissor consulta a chave e nunca conclui pelo `cStat` sozinho. O encerramento registrado no mesmo município volta como `registrado` com `recuperado: true`. Encerrado em outro município, o desfecho é `recusado` com o 631. Se a consulta mostra o MDF-e encerrado mas sem o evento legível, ou não mostra o evento depois de um pedido sem resposta, o desfecho é `pendente`: consulte de novo mais tarde. Sem o emissor, `recuperarEventoRegistrado(cliente, chave, '110112')`, do `sinete/mdfe`, faz a mesma consulta.

Para saber o que ainda está aberto, `emissor.cliente.consultarNaoEncerrados()` consulta os MDF-e do titular do certificado. Quando `tipo` é `'autorizado'`, `valor` contém a lista de chaves e protocolos: `cStat: '111'` indica documentos encontrados e `cStat: '112'` indica uma lista vazia.

## Contingência off-line

Com a SEFAZ fora do ar, o MDF-e pode ser emitido em contingência off-line, para transmissão posterior: veja [contingência](contingencia.md).

## Armadilhas

- **Remontar depois de uma queda.** Enquanto os bytes assinados estiverem gravados no `store`, `emitir('viagem-7', ...)` retoma a emissão com eles. Preserve a mesma referência da viagem. Montar novamente pode gerar outro `cMDF`, o código numérico que compõe a chave de acesso, e produzir outra chave para o mesmo número de MDF-e.
- **Esquecer de encerrar.** Um MDF-e aberto pode bloquear novas autorizações, inclusive a viagem de volta. Inclua o encerramento no fluxo de chegada e consulte periodicamente os documentos não encerrados.
- **`tpAmb` trocado.** O campo `tpAmb` identifica o ambiente de autorização, produção ou homologação. O MDF-e é enviado comprimido, e a política de hosts do transporte não consegue examinar esse campo dentro dele. Por isso, o cliente confere o `tpAmb` contra o ambiente configurado antes do envio e, se houver divergência, lança `ErroPolitica` (`politica_recusou`).

## Veja também

- [Cancelamento](cancelamento.md) (até 24 horas depois da autorização).
- [Documentos auxiliares](documentos-auxiliares.md) (DAMDFE, Documento Auxiliar do MDF-e).
- Referência: [`@sinete/mdfe`](../referencia/mdfe.md) e [`@sinete/emissor`](../referencia/emissor.md).
