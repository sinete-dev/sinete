# Tutorial: primeira NF-e em homologação

Neste tutorial você emite uma Nota Fiscal eletrônica (NF-e) com o emissor do sinete (`sinete/emissor/nfe`), do começo ao fim, sem certificado real e sem acessar a Secretaria da Fazenda (SEFAZ). O certificado é sintético e o atendimento é feito pelo simulador `@sinete/sefaz-sim`, que implementa os web services usados aqui, aplica suas validações na ordem da SEFAZ e guarda estado. No caminho você vê o que acontece quando a conexão cai depois da autorização, gera o Documento Auxiliar da NF-e (DANFE) e, no fim, troca o simulador pelo certificado real e pela SEFAZ de homologação, o ambiente de testes fiscais. Os blocos TypeScript deste tutorial são verificados pelo `bun run check` contra a API do repositório.

## O que você precisa

Node `^20.19.0 || >=22.12.0` ou Bun, e um projeto ESM com TypeScript. Instale o pacote `sinete`, que reúne os pacotes da biblioteca, e o simulador como dependência de desenvolvimento:

```sh
npm install sinete
npm install -D @sinete/sefaz-sim
```

O simulador fica fora do pacote `sinete` de propósito: é ferramenta de teste e não deve ir para a instalação de produção.

## 1. Um certificado e uma SEFAZ de mentira

O simulador gera na hora uma autoridade certificadora (AC) de teste e um e-CNPJ, certificado digital de pessoa jurídica, assinado por ela. O relógio é fixo (`manualClock`) para manter a data do tutorial: ela determina o leiaute vigente e as alíquotas do Imposto sobre Bens e Serviços (IBS) e da Contribuição sobre Bens e Serviços (CBS). Na aplicação, não passe relógio nenhum; o padrão é o do sistema.

```ts completo
import { writeFile } from 'node:fs/promises';
import {
  createSefazSim,
  redirectToSim,
  SIM_BASE_URL,
  simTransport,
  syntheticCertificate,
  syntheticPfx,
} from '@sinete/sefaz-sim';
import { relogioManual } from 'sinete/core';
import { createMemoriaStore } from 'sinete/emissor/memoria';
import { createNfeEmissor } from 'sinete/emissor/nfe';
import type { NfeInput } from 'sinete/nfe';

const clock = relogioManual('2026-09-26T10:00:00-03:00');
const ac = await syntheticCertificate({ clock, role: 'ac' });
const titular = await syntheticCertificate({ clock, role: 'titular', cnpj: '11222333000181', issuer: ac });
const sim = createSefazSim({ clock });
```

## 2. O emissor

O emissor abre o PFX, arquivo que contém o certificado e sua chave privada, e cria o transporte mTLS na primeira chamada de rede. No mTLS, tanto o servidor quanto o cliente apresentam certificados. O emissor também cuida do estado entre chamadas: grava os bytes assinados antes de enviar, usa a trava do `store` para impedir transmissões simultâneas do mesmo documento e decide o que fazer com os bytes depois de cada resposta. Duas opções merecem atenção:

- `store`: onde os bytes assinados ficam gravados até a SEFAZ decidir. É obrigatório. Aqui é o adaptador em memória, que só serve para testes e scripts de um processo; na aplicação, use um `TransmissaoStore` sobre o seu banco (veja [como implementar o store num banco SQL](../como-fazer/store-sql.md)).
- `aoDecidir`: onde a nota autorizada ou denegada, cujo uso foi negado pela SEFAZ, vai para o seu sistema. É obrigatório no emissor ou na chamada de emissão. Roda antes de os bytes gravados serem apagados e pode rodar de novo depois de uma queda, então precisa ser idempotente: repetir a operação deve produzir o mesmo resultado. Aqui usamos um `Map` pela referência do pedido. Quando uma denegação vem sem `digVal`, o resumo criptográfico do documento no protocolo, não há `nfeProc`, o XML que reúne a nota e seu protocolo. Nesse caso, a aplicação deve guardar o XML assinado de `registro.xml` e o protocolo `protNFe`; o `Map` abaixo guarda apenas o protocolo.

A opção `transporte` permite personalizar o transporte. Neste tutorial, ela troca o transporte real pelo simulador em processo, com o certificado do titular no canal.

```ts continua
const notas = new Map<string, string>();

const emissor = await createNfeEmissor({
  pfx: syntheticPfx(titular, 'senha-de-teste', { chain: [ac] }),
  senha: 'senha-de-teste',
  ambiente: 'homologacao',
  clock,
  store: createMemoriaStore({ clock }),
  aoDecidir: (registro, desfecho) => {
    // A denegação cujo protocolo veio sem digVal não traz nfeProc: na aplicação, guarde os bytes (`xml`) e o protNFe.
    notas.set(registro.ref, desfecho.proc ?? desfecho.protocolo.protNFe);
  },
  transporte: () => redirectToSim(simTransport(sim, { clientCertificate: titular.der }), SIM_BASE_URL),
});
```

## 3. A nota

A entrada (`NfeInput`) usa os nomes do leiaute nos campos e nomes em português nos grupos. Valores decimais vão como texto (`'10.00'`) para evitar perda de precisão. A montagem calcula os totais e os valores do Imposto sobre Circulação de Mercadorias e Serviços (ICMS) a partir dos dados informados, além de gerar a chave de acesso e, quando omitido, o código numérico da nota. O IBS e a CBS do item são calculados pela calculadora padrão a partir de `CST`, o Código de Situação Tributária, e `cClassTrib`, o código de classificação tributária, com a base de cálculo informada em `vBC`.

```ts continua
const nota: NfeInput = {
  serie: 1,
  nNF: 1,
  natOp: 'VENDA DE MERCADORIA',
  tpNF: '1',
  emitente: {
    CNPJ: '11222333000181',
    xNome: 'EMITENTE DE TESTE',
    endereco: {
      xLgr: 'RUA DE TESTE',
      nro: '1',
      xBairro: 'CENTRO',
      cMun: '3550308',
      xMun: 'SAO PAULO',
      UF: 'SP',
      CEP: '01001000',
    },
    IE: '110042490114',
    CRT: '3',
  },
  destinatario: {
    CPF: '11144477735',
    xNome: 'DESTINATARIO DE TESTE',
    indIEDest: '9',
    // A NF-e (modelo 55) sempre leva o endereço do destinatário (MOC 7.0 Anexo I, RV E05-10).
    endereco: { xLgr: 'RUA DO CLIENTE', nro: '2', xBairro: 'CENTRO', cMun: '3550308', xMun: 'SAO PAULO', UF: 'SP' },
  },
  itens: [
    {
      produto: {
        cProd: '1',
        xProd: 'PARAFUSO',
        NCM: '73181500',
        CFOP: '5102',
        uCom: 'UN',
        qCom: '10',
        vUnCom: '1.00',
      },
      impostos: {
        icms: { CST: '00', orig: '0', pICMS: '18' },
        pis: { CST: '07' },
        cofins: { CST: '07' },
        ibsCbs: { classificacao: { CST: '000', cClassTrib: '000001', vBC: '10.00' } },
      },
    },
  ],
  pagamento: { detPag: [{ tPag: '17', vPag: '10.00' }] },
};
```

## 4. Emitir

`emitir(ref, nota)` recebe a referência do documento no seu sistema, como o identificador do pedido ou do rascunho, estável entre tentativas, e a entrada. Ele monta, valida, assina, grava os bytes no `store`, envia e devolve um desfecho com `tipo`. Quando a montagem detecta problemas na entrada, lança `ValidationError` com as ocorrências encontradas antes de gravar os bytes da transmissão. Nas respostas da SEFAZ, `cStat` é o código da situação e `xMotivo` é sua descrição.

```ts continua
const d1 = await emissor.emitir('pedido-1', nota);
switch (d1.tipo) {
  case 'autorizado':
    console.log('autorizada', d1.id, d1.cStat, 'guardada:', notas.has('pedido-1'));
    break;
  case 'recusado':
    console.log('recusada', d1.cStat, d1.xMotivo, d1.hint?.comoCorrigir);
    break;
  default:
    console.log(d1.tipo);
}
```

A nota sai com `tipo: 'autorizado'` e `cStat` 100. O `aoDecidir` já guardou o `nfeProc`, e os bytes da transmissão foram apagados do `store` depois disso. Se a SEFAZ recusasse definitivamente a nota (`recusado`), os bytes seriam descartados e você corrigiria a entrada e emitiria de novo com a mesma `ref`.

Evite reenviar repetidamente a nota sem corrigir a causa da recusa. Com um `store` que implementa `registrarRecusa` e `recusaRecente`, como o adaptador em memória, a barreira de recusa repetida fica ativa por padrão. Depois de três recusas iguais do mesmo conteúdo para a mesma referência em uma hora, a próxima tentativa igual lança `RecusaRepetidaError` antes de gravar e enviar. Isso ajuda a evitar o bloqueio por consumo indevido, identificado pela SEFAZ com `cStat` 656. Corrigir o conteúdo permite uma nova tentativa.

## 5. A conexão cai depois de a SEFAZ autorizar

Este é um caso em que uma implementação sem recuperação pode tentar emitir novamente uma nota já autorizada: a SEFAZ processa, a resposta não chega e a aplicação monta a nota de novo. Se o código numérico não foi informado, remontar pode gerar outro; com o relógio do sistema, `dhEmi`, a data e hora de emissão, também pode mudar. A nova chave pode causar a rejeição 539, duplicidade de NF-e com diferença na chave de acesso. Se a aplicação tentar resolver isso usando outro número, pode autorizar uma segunda nota para a mesma operação. O simulador reproduz a queda:

```ts continua
sim.injectFault({ kind: 'drop', phase: 'after' }, { servico: 'NFeAutorizacao' });
const d2 = await emissor.emitir('pedido-2', { ...nota, nNF: 2 });
console.log(d2.tipo, notas.has('pedido-2'));
```

O desfecho é `autorizado` mesmo assim. O emissor não remontou a nota: consultou a chave correspondente aos bytes gravados, encontrou a nota autorizada com o mesmo conteúdo e montou o `nfeProc` com eles. Se nem a consulta respondesse, o desfecho seria `pendente` e os bytes continuariam gravados. O próximo `emitir('pedido-2', ...)`, ou a [retomada automática](../como-fazer/retomada.md), continuaria com esses bytes, ignorando a entrada recebida.

## 6. O DANFE

`pdf(nfeProc)` gera o DANFE com o `@sinete/da`, que o pacote `sinete` já traz. No fim, `fechar()` encerra as conexões do transporte.

```ts continua
if (d1.tipo === 'autorizado') await writeFile('danfe-pedido-1.pdf', await emissor.pdf(d1.proc));
await emissor.fechar();
```

Em homologação, o DANFE sai com a marca "SEM VALOR FISCAL". Na montagem da NF-e, o nome do destinatário já é trocado pelo texto literal que a SEFAZ exige nesse ambiente, conforme o Manual de Orientação do Contribuinte (MOC) 7.0, Anexo I, regra de validação E04-20.

## 7. Onde entra o certificado real

Para emitir na SEFAZ de homologação de verdade com um certificado A1, mude três coisas no emissor: substitua o PFX e a senha pelos do certificado real, remova `transporte` e remova `clock`. O transporte padrão usa mTLS, permite os hosts de homologação e confere `tpAmb`, o código do ambiente, no corpo da requisição.

A nota precisa trazer a identidade fiscal do emitente, com a inscrição estadual (`IE`) e o endereço reais. Para e-CNPJ, os oito primeiros caracteres do CNPJ do emitente, o CNPJ-base, precisam coincidir com os do certificado; a divergência corresponde à rejeição 213. Para e-CPF, o CPF precisa coincidir integralmente; a divergência corresponde à rejeição 227. O emissor confere essa correspondência localmente e lança `ValidationError` antes de transmitir.

```ts sem-execucao
import { readFile } from 'node:fs/promises';
import { createNfeEmissor } from 'sinete/emissor/nfe';

const senha = process.env.SINETE_PFX_SENHA;
if (senha === undefined) throw new Error('defina SINETE_PFX_SENHA');

const emissor = await createNfeEmissor({
  pfx: await readFile('empresa.pfx'),
  senha,
  ambiente: 'homologacao',
  store: meuStore, // TransmissaoStore sobre o banco da aplicação
  aoDecidir: guardarNota, // upsert pela ref, idempotente
});
```

Neste trecho, `meuStore` é o adaptador do seu banco e `guardarNota` é a função da aplicação que grava a nota de forma idempotente.

Certificados A3 também são suportados pelo helper `sinete-signer`, distribuído no npm como `@sinete/signer`, com cliente em `@sinete/transport/signer`. Ele permite usar tokens pela interface PKCS#11, A3 em nuvem de um prestador de serviço de confiança (PSC) e chaves não exportáveis. Nesse caso, siga [como usar certificado A3 e chave fora do processo](../como-fazer/certificado-a3.md) para fornecer `certificado` ao emissor no lugar de `pfx` e `senha`.

A senha do certificado real vem do ambiente, nunca de argumento nem do código. Antes da primeira emissão com A1, confira o certificado, a cadeia de certificação, o relógio e a conexão TLS com o autorizador da sua UF pela interface de linha de comando (CLI), que não exibe a chave privada nem a senha:

```sh
export SINETE_PFX_SENHA=...
npx sinete doctor --pfx empresa.pfx --uf SP --status
```

## Próximos passos

- [Implementar o `TransmissaoStore` no seu banco e rodar a suíte de contrato](../como-fazer/store-sql.md): isso permite preservar as transmissões entre reinicializações e coordenar processos.
- [Retomar o que ficou pendente](../como-fazer/retomada.md) com um job, uma tarefa executada em segundo plano.
- [Por que os bytes são gravados antes do envio](../explicacao/bytes-antes-do-envio.md).
