# Como emitir por vários emitentes no mesmo servidor

Um servidor que emite para muitas empresas precisa administrar certificados por emitente, transmissões simultâneas e um banco que associe cada pedido, rascunho e nota ao seu emitente. Esta página mostra como montar o emissor para esse caso: abrir o certificado uma vez por criação de emissor e reaproveitá-lo pelo pool, um conjunto de emissores reutilizáveis; definir as funções `aoDecidir` e `jaGuardado` por chamada; e preparar a entrada só depois de obter a trava que impede transmissões simultâneas do mesmo documento.

## 1. Um emissor por certificado, com o certificado aberto uma vez

`abrirCertificado` abre o arquivo PFX do certificado A1 como o emissor abriria e devolve o certificado aberto: `signer`, usado para assinar documentos; `titular`, com a identificação do titular; e `identidade`, usada no mTLS, a conexão TLS com autenticação também por certificado do cliente. Com `completarCadeia: true`, a identidade leva a cadeia de certificados até a raiz, usando os certificados do PFX e os das autoridades certificadoras da ICP-Brasil que o `@sinete/cert` conhece. Isso atende ao PFX que só traz o certificado do titular. O emissor recebe esse certificado aberto em `certificado`, no lugar de `pfx` e `senha`, e o seu código pode usar o mesmo `signer` em outras operações sem abrir o arquivo de novo.

O pool identifica cada certificado por uma chave e reutiliza o emissor correspondente enquanto ele permanecer no pool. A opção `chave` permite usar, por exemplo, o identificador do certificado no banco. Sem essa opção, o pool calcula a chave a partir de `pfx` e `senha`; ela é obrigatória quando esses campos não estão disponíveis. O PFX é aberto novamente quando o pool precisa criar outro emissor para o certificado.

```ts
import { abrirCertificado, createPoolDeEmissores } from 'sinete/emissor';
import { createNfeEmissor } from 'sinete/emissor/nfe';

interface CertificadoDoBanco {
  id: string;
  pfx: Uint8Array;
  senha: string;
}

const pool = createPoolDeEmissores({
  chave: (c: CertificadoDoBanco) => c.id,
  criar: async (c) => {
    const certificado = await abrirCertificado(c, { completarCadeia: true });
    return createNfeEmissor({ certificado, ambiente: 'producao', store, situacaoPosterior: 'divergente' });
  },
});
```

O exemplo cria um emissor de Nota Fiscal Eletrônica (NF-e). O `store` é a implementação da aplicação que persiste os bytes do documento e controla a trava entre processos. O emissor acima não tem `aoDecidir`, a função que guarda no sistema o documento autorizado ou denegado: cada chamada fornece a sua, como mostrado abaixo. Sem `aoDecidir` no emissor nem na chamada, `emitir` e `retomar` lançam `ErroDeConfiguracao` antes de obter a trava.

`situacaoPosterior: 'divergente'` atende a quem não quer guardar como ativo um documento que já foi cancelado ou encerrado fora deste fluxo. Quando a consulta encontra um documento autorizado nessa situação, o resultado passa a ser `divergente`, com `situacaoAtual` e `proc`, o documento processado com seu protocolo de autorização. Os bytes permanecem gravados para análise, sem chamar `aoDecidir`. O padrão (`guardar`) entrega o resultado `autorizado` ao `aoDecidir` com `situacaoAtual`.

## 2. `aoDecidir` e `jaGuardado` por chamada

Duas transmissões de documentos distintos podem usar o mesmo emissor ao mesmo tempo e guardar cada resultado no seu destino: o `aoDecidir` da chamada tem prioridade sobre o do emissor. O mesmo vale para `jaGuardado`.

Quando já há bytes gravados, `jaGuardado` verifica, com a trava obtida e antes de acessar a Secretaria da Fazenda (SEFAZ), se o documento correspondente já está salvo no sistema. Se a função retornar `true`, o emissor apaga a gravação pendente e devolve `ja-guardado`, sem consultar a SEFAZ e sem chamar `aoDecidir`. Isso resolve o caso de uma interrupção entre salvar o documento no sistema e apagar os bytes pendentes.

## 3. A entrada preparada depois da trava

`emitir` aceita, no lugar da entrada pronta, uma função que a prepara. Ela roda com a trava do documento e só quando não há bytes gravados. Use essa função para conferir que o documento ainda pode ser emitido, por exemplo, que o rascunho não virou nota por outro caminho, e para ler do banco os dados necessários à montagem. O `meta`, objeto com dados adicionais que ela pode devolver, é gravado com os bytes e fica disponível no registro da retomada. Quando já há bytes gravados, a função não roda: a transmissão usa esses bytes.

A entrada preparada pode incluir opções de montagem específicas do documento: `{ nfe, montagem }` na NF-e e `{ mdfe, montagem }` no Manifesto Eletrônico de Documentos Fiscais (MDF-e). As opções fornecidas têm prioridade sobre as correspondentes do emissor. Na NF-e, isso permite usar a data e a hora de emissão gravadas no rascunho e a calculadora do emitente para o Imposto sobre Bens e Serviços (IBS) e a Contribuição sobre Bens e Serviços (CBS).

```ts
import { relogioFixo, contextoDeTempo } from 'sinete/core';

const desfecho = await pool.usar(await certificadoDoEmitente(pedido.emitenteId), (nfe) =>
  nfe.emitir(
    pedido.id,
    async () => {
      const rascunho = await db.rascunhos.travado(pedido.id); // lança se já não é rascunho
      return {
        entrada: { nfe: notaDe(rascunho), montagem: { time: contextoDeTempo({ emissao: relogioFixo(rascunho.emissao) }) } },
        meta: { emitenteId: pedido.emitenteId },
      };
    },
    {
      aoDecidir: (registro, d) => db.notas.guardar(registro.ref, d), // upsert pela ref
      jaGuardado: async (registro) => (await db.notas.chave(registro.ref)) === registro.id,
    },
  ),
);
```

No exemplo, `pedido`, `db`, `certificadoDoEmitente` e `notaDe` pertencem à aplicação. `registro.ref` é a referência do documento no sistema, aqui `pedido.id`, e `registro.id` é a chave de acesso da NF-e. `db.notas.guardar` precisa ser idempotente: chamadas repetidas com o mesmo documento devem preservar o mesmo resultado, sem duplicá-lo.

## 4. A retomada com os mesmos ganchos

`retomarPendentes` aceita `aoDecidir` e `jaGuardado` e os passa a cada `retomar`. Assim, a tarefa agendada usa o mesmo pool e guarda os documentos da mesma forma que a emissão iniciada pelo usuário:

```ts
import { retomarPendentes } from 'sinete/emissor';

await retomarPendentes({
  store,
  usarEmissor: async (registro, fn) => pool.usar(await certificadoDoEmitente(registro.meta.emitenteId), fn),
  aoDecidir: (registro, d) => db.notas.guardar(registro.ref, d),
  jaGuardado: async (registro) => (await db.notas.chave(registro.ref)) === registro.id,
  aoAlertar: (registro, ultimo) => filaDeAlertas.gravar({ ref: registro.ref, ultimo }),
});
```

## Armadilhas

- **`jaGuardado` que só olha a `ref`.** Compare a chave de acesso (`registro.id`), não só a existência de uma nota para a `ref`: uma nota recusada e depois corrigida pode manter a mesma `ref` e ter outra chave.
- **Preparar fora da função.** Ler o rascunho antes de `emitir` e passar a entrada pronta deixa um intervalo entre a leitura e a obtenção da trava; outra transmissão pode ter emitido o documento nesse meio tempo. Leia dentro da função.
- **Um emissor por transmissão.** Criar um emissor e abrir o PFX a cada chamada impede o reaproveitamento das conexões do transporte e do certificado aberto. Use o pool.
- **Senha no `meta`.** O `meta` fica gravado no banco com os bytes. Guarde o identificador do emitente e busque o certificado por ele.

## Veja também

- [Retomar documentos pendentes](retomada.md).
- [Por que gravar os bytes antes do envio](../explicacao/bytes-antes-do-envio.md).
- Referência: [`@sinete/emissor`](../referencia/emissor.md).
