# Como emitir a NFS-e Nacional

A NFS-e Nacional (Nota Fiscal de Serviço eletrônica, leiaute 1.01) é emitida a partir da DPS (Declaração de Prestação de Serviço), que o emitente assina e envia à Sefin Nacional, o serviço nacional de autorização, por uma API REST. A Sefin gera a NFS-e e devolve seu XML. O sinete monta e valida a DPS contra o XSD vigente, o esquema que define a estrutura do XML, e insere a assinatura sem reserializar o documento. Quando a resposta do envio se perde, consulta a DPS para verificar se houve emissão. As NFS-e municipais de leiaute próprio ficam fora do sinete.

## Emitir

No exemplo, `pfx` contém os bytes do certificado A1, `senha` permite abri-lo, `store` persiste os bytes da DPS e coordena as transmissões, e `aoDecidir` recebe o desfecho para que a aplicação o guarde. `cnpjPrestador`, `cnpjTomador` e `nomeTomador` vêm dos dados da aplicação. O ambiente `homologacao` corresponde à produção restrita. Nas recusas, `cStat` contém o código retornado pela Sefin e `xMotivo`, a descrição.

```ts
import { criarEmissorNfse } from 'sinete/emissor/nfse';
import type { DadosDps } from 'sinete/nfse';

const emissor = await criarEmissorNfse({ pfx, senha, ambiente: 'homologacao', store, aoDecidir });

const dps: DadosDps = {
  serie: '1',
  nDPS: '1',
  cLocEmi: '3550308',
  prestador: { CNPJ: cnpjPrestador, regTrib: { opSimpNac: '3', regApTribSN: '1', regEspTrib: '0' } },
  tomador: { CNPJ: cnpjTomador, xNome: nomeTomador },
  servico: {
    local: { cLocPrestacao: '3550308' },
    cTribNac: '01.01.01',
    xDescServ: 'Desenvolvimento de software sob encomenda',
    cNBS: '115021000',
  },
  valores: { vServ: '1500.00' },
  tributacao: { issqn: { tribISSQN: '1', tpRetISSQN: '1' }, totTrib: { pTotTribSN: '6.00' } },
};

const d = await emissor.emitir('servico-9', dps);
if (d.tipo === 'autorizado') console.log(d.protocolo.chaveAcesso, d.protocolo.nNFSe);
else if (d.tipo === 'recusado') console.log(d.cStat, d.xMotivo); // código E da Sefin, por exemplo E0312
```

- **Identidade dos bytes.** Na NFS-e, o `id` do desfecho é o identificador da DPS, formado pelo município, tipo e número da inscrição federal do emitente, série e número da DPS. Esse identificador existe antes da resposta; a chave da NFS-e só vem depois, em `protocolo.chaveAcesso`. O XML da NFS-e fica em `proc`.
- **Rejeição.** A Sefin responde com códigos `E` seguidos de quatro dígitos, que vão em `cStat`. Quando o catálogo de rejeições do sinete tem uma orientação para o código do Anexo I do leiaute, ela vem em `dica`. E0312 indica que o código de tributação nacional não está administrado pelo município de incidência do ISSQN (Imposto Sobre Serviços de Qualquer Natureza) na data de competência informada na DPS. É uma regra de nível 3, dependente da parametrização municipal.
- **Resposta perdida.** O emissor consulta a DPS pelo identificador e, se encontrar a chave, consulta a NFS-e. Compara o `DigestValue`, o resumo criptográfico do conteúdo assinado, quando ele está presente nas duas DPS. Se os valores diferirem, o desfecho é `divergente`; se coincidirem, é `autorizado`. Na ausência de um dos resumos, a confirmação usa o identificador da DPS. Se a consulta indicar que a DPS não gerou NFS-e, o emissor reenvia os mesmos bytes uma vez. A duplicidade E0014 também leva à consulta. Se a comunicação continuar sem resposta, o desfecho pode ficar `pendente`.
- **Declaração XML.** A DPS sai com `<?xml version="1.0" encoding="UTF-8"?>`; sem ela, a Sefin recusa com E1229 antes de validar o esquema XML. Não retire a declaração ao guardar ou reenviar.
- **Total aproximado dos tributos.** O Anexo I vincula o grupo `totTrib` ao regime do emitente no Simples Nacional (E0710, E0712, E0713). Quando o prestador é o emitente, o sinete confere esse regime e uma combinação proibida gera a ocorrência `campo_proibido` antes do envio. Se o emitente for o tomador ou o intermediário, o grupo continua obrigatório, mas essa conferência local não é feita porque a DPS não informa o regime dele.

## Certificado no canal

A Sefin autoriza pelo certificado apresentado na conexão TLS e exige a DPS assinada pelo emitente (E0718 com outro titular). Uma conexão com certificado de outro contribuinte recebe HTTP 403, que o Anexo I não codifica. Na NFS-e, o sinete não usa transmissor terceiro: o emissor apresenta na conexão o mesmo e-CNPJ ou e-CPF que assina a DPS.

A Sefin pede o certificado por renegociação TLS 1.2, uma etapa adicional de autenticação durante a conexão. Com o certificado em processo, Node e Bun conseguem se conectar, mas o transporte nativo do Deno não suporta essa renegociação. Pelo helper `sinete-signer`, o Deno também consegue acessar a Sefin. O helper permite usar A3 em token PKCS#11, A3 em nuvem de um PSC (Prestador de Serviço de Confiança) e chave não exportável. Seu cliente está em `@sinete/transport/signer`, e o binário é distribuído pelo pacote npm `@sinete/signer`. Veja [certificado A3 e chave fora do processo](certificado-a3.md).

## Substituir

A substituição troca uma NFS-e por outra, por exemplo, para corrigir o valor ou o tomador. A nova DPS leva o grupo `substituicao` com a chave da nota substituída. A Sefin gera a nova NFS-e e registra automaticamente o cancelamento por substituição da anterior (evento e105102). `substituir` tem a mesma gravação e retomada de `emitir`.

```ts
import { criarEmissorNfse } from 'sinete/emissor/nfse';

const emissor = await criarEmissorNfse({ pfx, senha, ambiente: 'homologacao', store, aoDecidir });
const d = await emissor.substituir('servico-9-v2', {
  ...dps,
  nDPS: '2',
  valores: { vServ: '1800.00' },
  substituicao: { chSubstda: chaveAnterior, cMotivo: '99', xMotivo: 'Valor do servico corrigido' },
});
```

## Cancelar e consultar

`emissor.cancelar({ chave, cMotivo, xMotivo })` registra o evento de cancelamento e101101. Se a resposta se perder ou vier E0840, indicando um evento já vinculado à NFS-e, o emissor consulta o cancelamento de tipo `101101`, sequência `1`. Se encontrá-lo, devolve o evento registrado com `recuperado: true`. O código E0840 sozinho não confirma o cancelamento; sem o evento na consulta, a recusa permanece. Veja [cancelamento](cancelamento.md).

`emissor.consultar(chave)` devolve a NFS-e ou `undefined` quando a Sefin não a conhece. A consulta é REST e não retorna `cStat`. Os outros serviços, como consulta de eventos por tipo e sequência, solicitação de análise fiscal e parâmetros municipais com cache, estão em `emissor.cliente`. A consulta de eventos exige tanto o tipo quanto a sequência, porque a Sefin não lista os eventos de uma NFS-e sem esses dados.

## IBS e CBS

A DPS leva a classificação do IBS (Imposto sobre Bens e Serviços) e da CBS (Contribuição sobre Bens e Serviços) no grupo `ibsCbs`. Os valores dos tributos são calculados pela Sefin e vêm na NFS-e, conforme a Nota Técnica SE/CGNFS-e 004. Veja [IBS e CBS](ibs-cbs.md).

## O DANFSe

A API de geração do DANFSe (Documento Auxiliar da NFS-e) do ADN (Ambiente de Dados Nacional) foi suspensa em 03/08/2026, conforme a Nota Técnica SE/CGNFS-e 008/2026, seção 1. O emissor gera o DANFSe v2 localmente, pelo `@sinete/da/nfse`.

`emissor.pdf(d.proc)` gera o PDF a partir do XML de um desfecho autorizado, sem acesso à rede. `emissor.pdfCancelado(nfse, evento)` recebe o XML da NFS-e e o XML do evento registrado e gera o documento com a marca de cancelada ou substituída, conforme o tipo do evento. `emissor.pdfPorChave(chave)` consulta a NFS-e e os eventos que podem marcá-la como cancelada ou substituída e então gera o PDF. Esse método pode fazer cinco consultas e devolve `undefined` se a Sefin não conhecer a chave. Prefira o XML guardado quando ele estiver disponível. Veja [documentos auxiliares](documentos-auxiliares.md#danfse).

## Armadilhas

- **Outra DPS para o mesmo número.** Depois de uma resposta perdida, uma DPS com o mesmo identificador e outro conteúdo não é um reenvio: a Sefin já pode ter gerado a NFS-e da primeira. Retome pelos bytes gravados, chamando `emitir` com a mesma `ref`, a referência da transmissão definida pela aplicação.
- **`cTribNac` com e sem pontos.** A DPS aceita `01.01.01` ou `010101` e grava os seis dígitos. A API de parâmetros municipais do ADN exige nove dígitos com pontos (`01.01.01.000`) e responde HTTP 400 quando recebe o código sem pontos. Os métodos de `emissor.cliente.parametros` fazem essa conversão: aceitam os dois formatos de seis dígitos e acrescentam o código municipal `000`, ou recebem diretamente o formato de nove dígitos com pontos.
- **Valor com mais de duas casas.** Casas adicionais que exigiriam arredondamento geram a ocorrência `valor_casas`. Zeros excedentes em texto, como em `'1500.000'`, são aceitos e removidos. Para números, há tolerância apenas ao ruído da representação binária, sem arredondamento silencioso de valores com precisão maior.

## Veja também

- [Cancelamento](cancelamento.md).
- [Retomada](retomada.md).
- Referência: [`@sinete/nfse`](../referencia/nfse.md) e [`@sinete/emissor`](../referencia/emissor.md).
