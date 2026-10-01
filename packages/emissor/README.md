# @sinete/emissor

A camada que emite, retoma e cancela DF-e com estado entre chamadas: os bytes assinados gravados antes do envio, a trava entre processos, a política do que fazer com os bytes depois de cada resposta da SEFAZ, a retomada automática, o cancelamento com recuperação e o pool de emissores por certificado. Um emissor por documento, cada um no seu subpath: `@sinete/emissor/nfe`, `/mdfe` e `/nfse`.

Status: pré-alfa, 0.x, a camada mais nova do sinete; a API muda enquanto o primeiro integrador migra para ela. Testado contra o `@sinete/sefaz-sim` por HTTPS com mTLS, nunca contra a SEFAZ real (os serviços que ele usa foram, na NF-e: veja o `@sinete/nfe`). A fronteira com os pacotes de documento está no [ADR 0010](../../docs/adr/0010-fronteira-emissor.md).

```sh
npm i @sinete/emissor @sinete/nfe        # ou @sinete/mdfe, @sinete/nfse; o guarda-chuva `sinete` traz tudo
```

A documentação de uso vem no pacote, em `node_modules/@sinete/emissor/docs/` (a mesma do guarda-chuva `sinete`): tutorial, como implementar o `TransmissaoStore` em SQL, retomada, contingência, cancelamento e uma página por código de erro. `npx sinete agents-md` põe no `AGENTS.md` do projeto o bloco que manda o agente de código lê-la.

```ts
import { readFile } from 'node:fs/promises';
import { criarEmissorNfe } from '@sinete/emissor/nfe';

const nfe = await criarEmissorNfe({
  pfx: await readFile('empresa.pfx'),
  senha,
  ambiente: 'homologacao',
  store: meuStore, // TransmissaoStore sobre o banco da aplicação (abaixo)
  aoDecidir: async (registro, desfecho) => {
    // Guarda a nota decidida; roda de novo depois de uma queda, então precisa ser idempotente.
    const situacao = desfecho.tipo === 'denegado' ? 'denegada' : (desfecho.situacaoAtual ?? 'autorizada');
    // A denegação sem digVal no protocolo não traz `proc`: guarde os bytes (`xml`) e o protNFe (`protocolo.protNFe`).
    const protNFe = desfecho.proc === undefined ? desfecho.protocolo.protNFe : undefined;
    await db.notas.upsert(registro.ref, { chave: desfecho.id, xml: desfecho.proc ?? registro.xml, protNFe, situacao });
  },
});

const desfecho = await nfe.emitir('pedido-42', nota); // 'pedido-42' é o id da nota no seu sistema
switch (desfecho.tipo) {
  case 'autorizado': // já guardado pelo aoDecidir
  case 'denegado':
  case 'ja-guardado': // guardado antes de uma queda (gancho jaGuardado, abaixo)
    break;
  case 'recusado': // bytes descartados: corrija e emita de novo
    console.log(desfecho.cStat, desfecho.xMotivo, desfecho.dica);
    break;
  case 'pendente': // bytes gravados: o job (ou o próximo emitir) retoma
  case 'divergente': // a SEFAZ tem outro documento no número: alguém precisa olhar
    break;
  default: // caso novo numa versão minor: os bytes ficam gravados, trate como pendente e alerte
    console.warn('desfecho não tratado', desfecho);
}
```

O `Desfecho` é uma união aberta: um caso novo pode entrar numa versão minor ([ADR 0016](../../docs/adr/0016-politica-de-estabilidade.md), seção 2). Por isso o `switch` tem `default`, e não um `never` exaustivo, que quebraria a compilação nessa versão.

## O ciclo

`emitir(ref, entrada)` trava o documento `ref`, lê o que estiver gravado para ele e:

- **sem bytes gravados**: monta, valida (entrada inválida lança `ErroDeValidacao`, antes de gravar; na NF-e, também o emitente de outro CNPJ-base ou CPF que o certificado, rejeição 213 ou 227), assina, grava os bytes no `store` e só então envia;
- **com bytes gravados** (uma transmissão anterior ficou sem desfecho): retoma com eles e ignora a entrada. O documento nunca é montado de novo: remontar gera outro `cNF` e outro `dhEmi`, e a SEFAZ responde 539 ou autoriza um segundo documento para o mesmo número.

`entrada` também pode ser uma função que prepara a entrada só quando for montar, já com a trava e só sem bytes gravados: é onde o integrador confere que o documento ainda pode ser emitido e lê do banco o que vai na montagem, e o `meta` que ela devolve é o que fica gravado com os bytes. Numa retomada, nada disso roda.

```ts
const desfecho = await nfe.emitir(
  'pedido-42',
  async () => {
    const pedido = await db.pedidos.rascunho('pedido-42'); // lança se já não é rascunho
    return { entrada: { nfe: notaDe(pedido), montagem: { time: contextoDeTempo({ emissao: relogioFixo(pedido.emissao) }) } }, meta: { numero: pedido.numero } };
  },
  { aoDecidir: guardarPedido, jaGuardado: async (registro) => (await db.pedidos.chave('pedido-42')) === registro.id },
);
```

O `aoDecidir` e o `jaGuardado` vão no emissor (padrão de todas as chamadas) ou em cada chamada, que vale sobre o do emissor: duas transmissões ao mesmo tempo no mesmo emissor guardam cada uma do seu jeito. Sem `aoDecidir` em nenhum dos dois, `emitir` e `retomar` lançam `ErroDeConfiguracao` antes de travar.

**`jaGuardado`.** Se a transmissão cai depois de o integrador guardar o documento e antes de a gravação ser apagada, a próxima transmissão acha os bytes. Com o gancho, o emissor pergunta, com a trava e antes de ir à SEFAZ, se o documento destes bytes já foi guardado; se sim, apaga a gravação e devolve `ja-guardado`. Sem ele, a consulta da chave decide de novo e o `aoDecidir` roda outra vez (por isso ele é idempotente), e um documento cancelado ou encerrado nesse meio tempo volta com `situacaoAtual`.

Enquanto espera a SEFAZ, renova a trava (padrão: prazo de 10 minutos, renovado a cada terço). Antes de guardar o desfecho, e antes de devolver um desfecho que mantém os bytes, confere que a trava ainda é dela: quem perdeu a trava lança `ErroTravaPerdida` e não grava nada, e quem assumiu retoma pelos bytes (a retomada automática conta isso como `ocupada`, sem tentativa). No fim, solta a trava, dê certo ou não. Outro processo com a trava em vigor recebe `ErroTransmissaoEmAndamento` sem tocar a SEFAZ.

**Recusa repetida.** Reenviar a mesma nota com a mesma rejeição é o que a SEFAZ conta como consumo indevido e pune com até uma hora de bloqueio do emitente (rejeição 656, MOC 7.0 Anexo I, item 4.3.1). Com um `store` que lembra recusas (`registrarRecusa` e `recusaRecente`, opcionais), o emissor conta as recusas da nota pelo SHA-256 do conteúdo descartado (sem a hora de emissão, o código numérico da chave e a assinatura, que mudam a cada montagem) e pelo `cStat`. Quando a mesma recusa chega ao limite dentro da janela (`recusaRepetida: { janelaMs, limite }`, 3 vezes em 1 hora por padrão, contada desde a primeira), a próxima emissão da mesma `ref` com o mesmo conteúdo lança `ErroRecusaRepetida` antes de gravar e sem ir à SEFAZ: a 4ª tentativa igual não sai, bem antes das 30 da regra. Abaixo do limite a mesma nota vai, para quem resolveu a causa fora dela. A nota corrigida (outro conteúdo) passa e recomeça a conta; a retomada de bytes gravados nunca é barrada; a recusa do serviço (108, 109, 999) não conta. Depois de resolver uma causa que está fora da nota (o credenciamento do emitente, 203), `emitir(ref, entrada, { reenviarRecusado: true })` envia assim mesmo. `recusaRepetida: false` desliga.

O envio espera o recibo quando a SEFAZ responde 103 (mesmo no envio síncrono), trata o envio sem resposta (timeout, conexão caída, resposta fora do leiaute, abort depois de o pedido sair) e a duplicidade (204, 539; E0014 na NFS-e) pela consulta da chave com os mesmos bytes, e reenvia os mesmos bytes uma vez quando o documento não consta. Vai sempre ao autorizador do documento e da chave (cUF e, em SVC, o tpEmis): um emissor atende todas as UFs do certificado.

## Desfecho

Normalizado entre os documentos, com o desfecho bruto do pacote do documento em `bruto`. `id` é a chave de acesso (na NFS-e, o Id da DPS).

| `tipo` | Quando | Bytes gravados |
|---|---|---|
| `autorizado` | autorizado; `proc` é o `nfeProc`/`mdfeProc`/NFS-e com os bytes gravados; `situacaoAtual` (`cancelado`, `encerrado`) quando a consulta acha o documento já cancelado ou encerrado fora deste fluxo | `aoDecidir`, depois apagados |
| `denegado` | uso denegado (só NF-e); o número fica consumido. A denegação é da chave, então é definitiva mesmo quando o protocolo não prova o conteúdo: `conteudo` diz se o `digVal` confere (`confere`, com o `proc`), falta (`sem-digval`) ou prova outro conteúdo na mesma chave (`difere`); sem `proc`, o desfecho traz os bytes em `xml` e o `protNFe` em `protocolo` | `aoDecidir`, depois apagados |
| `ja-guardado` | o gancho `jaGuardado` disse que o documento destes bytes já foi guardado; nada foi à SEFAZ | apagados, sem `aoDecidir` |
| `recusado` | a SEFAZ recusou os bytes (`cStat`, `xMotivo`, `dica`) | apagados, menos os `cStat` indefinidos do documento (a duplicidade que a consulta não resolveu, o lote em processamento), que ficam |
| `pendente` | `motivo`: `sem-resposta` (o erro em `causa`), `consulta-indefinida` (serviço paralisado, por exemplo) ou `lote-em-processamento` (o recibo em `nRec`); `anterior` traz a recusa que levou à consulta (a duplicidade, 204 ou 539) quando a consulta não decidiu | ficam |
| `divergente` | a SEFAZ tem outro documento no número: a mesma chave com outro conteúdo (`conteudo: 'difere'`), ou outra chave (539, E0014; a registrada em `chaveRegistrada`). Também a chave autorizada cujo protocolo não traz o `digVal` nem na resposta nem na consulta (`conteudo: 'sem-digval'`): nada prova que o documento autorizado é o destes bytes. Com a opção `situacaoPosterior: 'divergente'`, também o documento autorizado que a consulta acha cancelado ou encerrado fora deste fluxo (`situacaoAtual` e `proc`), para quem não o guarda como ativo | ficam |

A regra está em `destinoDosBytes(desfecho, perfil.indefinido)`, e os códigos, em `src/data/cstat.json`, com a fonte.

## `TransmissaoStore`

A persistência é do integrador: o emissor não conhece o seu banco. A interface está em `src/store.ts`; o essencial:

- `travar(tipo, ref, prazoMs)` pega a trava se não houver outra em vigor (a vencida é assumida); `renovar` estende a própria trava ainda em vigor; `soltar` só solta a própria.
- `gravar(trava, { xml, id, meta })` só com a trava em vigor e sem bytes já gravados; é onde a numeração do emitente é reservada, na mesma transação. `descartar` também exige a trava em vigor; `concluir` exige só o dono (o documento já foi guardado) e é idempotente.
- `listarPendentes` e `registrarTentativa` servem à retomada automática.
- `registrarRecusa` e `recusaRecente`, opcionais e sempre juntos, contam as recusas iguais de cada documento para a barreira da recusa repetida, numa instrução atômica (dois processos que registram juntos não perdem uma). Guarde fora da linha dos bytes, que `soltar` apaga; a suíte de contrato confere os dois, e o adaptador que não os implementa passa `recusas: false`.

**Prazo e renovação usam o relógio do banco, não o do processo.** Dois processos com relógios diferentes decidiriam de forma diferente se uma trava venceu. A interface recebe durações (`prazoMs`, `idadeMaximaMs`, `paradaHaMs`), nunca instantes calculados no processo, e o adaptador as compara com o `NOW()` do banco. Um esboço em SQL: a trava é `UPDATE ... SET token = ?, trava_ate = NOW(6) + INTERVAL ? SECOND WHERE tipo = ? AND ref = ? AND (trava_ate IS NULL OR trava_ate <= NOW(6))` (com `prazoMs / 1000`) e vale se afetou uma linha.

**Rode a suíte de contrato** contra o seu adaptador, num banco de teste. Um adaptador errado produz nota duplicada; a suíte confere dez travas simultâneas com uma vencedora, a trava vencida assumida sem o dono antigo conseguir gravar, a renovação perdida recusando gravar, os bytes sobrevivendo a outro processo, `concluir` idempotente e a seleção da retomada:

```ts
import { casosDoContrato } from '@sinete/emissor/contrato';

for (const caso of casosDoContrato({
  criar: async () => {
    await db.truncate('transmissao');
    return { a: meuStore(db), b: meuStore(outraConexao) }; // dois "processos" sobre o mesmo banco
  },
})) {
  test(caso.nome, caso.rodar, 30_000); // Bun, Vitest ou node:test
}
```

**`@sinete/emissor/memoria`** é o adaptador de referência, em memória: só para testes e scripts de um processo. Se o processo cair depois de a SEFAZ autorizar e antes da resposta, a gravação some junto. Dois stores sobre o mesmo `criarBancoMemoria()` simulam dois processos.

## Retomada automática

`retomarPendentes` roda uma execução; o agendamento (cron, fila) é do integrador. Nunca monta: só retoma o que foi gravado, pelo mesmo `retomar` do emissor, com a mesma trava.

```ts
import { criarPoolDeEmissores, retomarPendentes } from '@sinete/emissor';

const resumo = await retomarPendentes({
  store,
  usarEmissor: async (registro, fn) => pool.usar(await certificadoDe(registro), fn),
  aoDecidir: guardarDocumento, // opcional: senão, vale o do emissor; `registro.tipo` e `registro.ref` dizem qual
  aoAlertar: (registro, ultimo, tentativas) => canalDeErros.enviar({ registro, ultimo, tentativas }),
  deveRetomar: (registro) => flags.retomada(registro.meta.emitente),
});
```

Política (`PoliticaRetomada`, todos com padrão): só gravações de até `idadeMaximaMs` (3 dias; finita e positiva, nunca infinita: depois disso, a chance de o emitente já ter feito outro documento para a mesma operação é alta, e a gravação espera o `emitir` do usuário), paradas há `paradaHaMs` (5 minutos) e sem trava em vigor; `lote` por execução (5), as nunca tentadas primeiro; nenhuma nova depois de `prazoMs` (7 minutos); alerta único (marcado no store antes do `aoAlertar`: no máximo uma vez; se a entrega pode falhar, o `aoAlertar` grava numa fila do próprio banco) depois de `alertarDepoisDe` tentativas sem desfecho (3), ou na primeira quando o desfecho é `divergente`; depois do alerta, uma tentativa por `intervaloDepoisDoAlertaMs` (1 hora). A retomada que perde a trava para o usuário não conta tentativa.

## Pool de emissores

```ts
const pool = criarPoolDeEmissores({ criar: (cert) => criarEmissorNfe({ ...cert, ambiente, store, aoDecidir }) });
const desfecho = await pool.usar({ pfx, senha }, (nfe) => nfe.emitir(ref, nota));
```

Um emissor por PFX e senha, por até `validadeMs` (10 minutos) e no máximo `maximo` (32) certificados; o transporte só fecha quando o último empréstimo termina. O empréstimo é por escopo (`usar`), sem `AsyncLocalStorage`. A chave do pool é o SHA-256 do PFX e da senha: nunca vai a log nem sai do pool.

**Certificado aberto.** Quem emite mais de um documento por certificado abre o PFX uma vez (`abrirCertificado`, com `completarCadeia` para mandar a cadeia inteira no mTLS) e passa `certificado` no lugar de `pfx` e `senha`. O pool aceita qualquer tipo de certificado com a opção `chave` (o id do certificado no seu banco, por exemplo):

```ts
const pool = criarPoolDeEmissores({
  chave: (c: { id: string; pfx: Uint8Array; senha: string }) => c.id,
  criar: async (c) => {
    const certificado = await abrirCertificado(c, { completarCadeia: true });
    return criarEmissorNfe({ certificado, ambiente, store, aoDecidir });
  },
});
```

## Emissores

| | NF-e (`/nfe`) | MDF-e (`/mdfe`) | NFS-e (`/nfse`) |
|---|---|---|---|
| emitir, retomar, assinar | `emitir(ref, DadosNfe)` ou `{ nfe, montagem }` | `emitir(ref, DadosMdfe)` ou `{ mdfe, montagem }` | `emitir(ref, DadosDps)`, `substituir(ref, dps)` |
| consultar | `consultar(chave, xml?)` | `consultar(chave, xml?)` | `consultar(chave)` |
| cancelar | com recuperação: sem `nProt`, pela consulta; sem resposta, 573 ou 580, confirma pela consulta (`recuperado: true`) | idem, com 631 | sem resposta ou E0840, confirma pelo evento 101101 na Sefin (`recuperado: true`) |
| outros eventos | `cartaCorrecao`, com a mesma recuperação, pela sequência e pelo texto | `encerrar`, com a mesma recuperação, pelo município | pelo `cliente` |
| PDF | `pdf(nfeProc)`, `pdfCancelado(nfeProc, procEventoNFe)` | `pdf(mdfeProc)`, `pdfCancelado(mdfeProc, procEventoMDFe)` | `pdf(nfse)`, `pdfCancelado(nfse, evento)` e `pdfPorChave(chave)`: o DANFSe v2 local |

`cancelar`, `cartaCorrecao` e `encerrar` devolvem um `DesfechoEvento` (`registrado`, `recusado`, `pendente`) e nunca concluem pelo `cStat` sozinho: 573, 580 e E0840 dizem que algo foi registrado, não que foi este evento; a prova é o evento na consulta (`recuperarEventoRegistrado` do pacote do documento, `consultarEventos` na NFS-e).

`assinar(entrada)` monta e assina sem gravar nem usar a rede (roda no browser). `cliente` é o cliente completo do documento, com o mesmo transporte e signer, para o resto. Cada subpath exporta também o perfil (`perfilNfe`, `perfilMdfe`, `perfilNfse`), para quem compõe o próprio emissor com `criarEmissor(perfil, opcoes)` da raiz.

Opções comuns: `pfx` e `senha` ou `certificado`, `ambiente` e `store` (obrigatórias), `aoDecidir` e `jaGuardado` (no emissor ou em cada chamada), `situacaoPosterior` (`guardar`, padrão, ou `divergente`), `recusaRepetida` (`{ janelaMs, limite }` ou `false`), `trava` (`prazoMs`, `renovarACadaMs`), `relogio`, `logger`, `timeoutMs`, `transporte` (recebe as opções padrão do transporte e devolve outro: somar uma AC de teste, apontar para o simulador). As do documento: `montagem` (de todos os documentos; a de um documento vai com ele, `{ nfe, montagem }`), `cliente`, `recibo` e `uf` (NF-e), `da` (NF-e, MDF-e e NFS-e).

**PDF.** O `@sinete/da` é peer dependency opcional. Em Node e Bun o emissor o importa na primeira chamada; sem o pacote, `pdf()` lança `ErroDeConfiguracao`. No browser e no Deno, importe-o de forma estática e passe o módulo: `import * as da from '@sinete/da/nfe'` e `criarEmissorNfe({ ..., da })`. Se a marca de cancelado falhar (evento de outro documento), `pdfCancelado` lança, e o integrador decide manter o PDF antigo. As opções do PDF são tipadas no emissor (`PdfNfeOpcoes`, `PdfMdfeOpcoes`, `PdfNfseOpcoes`) com os mesmos membros das do `@sinete/da` (`DanfeOpcoes`, `DamdfeOpcoes`, `DanfseOpcoes`), sem exigir o pacote para compilar.

**DANFSe.** A API de geração do ADN foi suspensa em 03/08/2026 (NT SE/CGNFS-e 008/2026, 1), então o emissor de NFS-e gera o DANFSe v2 pelo `@sinete/da/nfse`, como os outros documentos. `pdf(nfse)` usa o XML da NFS-e (o `proc` do desfecho autorizado, que o `aoDecidir` guardou) e não vai à rede. `pdfCancelado(nfse, evento)` põe a marca d'água pelo evento registrado: "SUBSTITUÍDA" com o e105102, "CANCELADA" com o e101101, o e105104 ou o e305101. Quem não guardou o XML usa `pdfPorChave(chave)`: consulta a NFS-e e os quatro eventos que marcam o documento na Sefin, põe a marca que achar e devolve `undefined` se a Sefin não conhece a chave.

## Dependências

`@sinete/core`, `@sinete/cert` e `@sinete/transport`. Os pacotes de documento e o `@sinete/da` são peer dependencies opcionais: quem só emite NF-e instala só o `@sinete/nfe`. A raiz não importa nenhum pacote de documento, e cada subpath importa só o seu (`test/subpaths.test.ts` confere no fonte).

**Deno com `npm:`.** Sem `node_modules`, o Deno só resolve a peer opcional que está no grafo estático do app: `import { criarEmissorNfe } from 'npm:@sinete/emissor/nfe'` sozinho falha com `Could not find package '@sinete/nfe'`. Importe também o pacote do documento, em qualquer ponto do app (a ordem não importa); declará-lo só no `imports` do `deno.json` não basta. Com `package.json` e `node_modules`, vale a resolução do Node e nada disso é preciso. A raiz e o `/memoria` não têm peer. Medido no Deno 2.9.1 e conferido pela smoke (ADR 0010).

```ts sem-checagem
import 'npm:@sinete/nfe';
import { criarEmissorNfe } from 'npm:@sinete/emissor/nfe';
```

## Licença

Apache-2.0.
