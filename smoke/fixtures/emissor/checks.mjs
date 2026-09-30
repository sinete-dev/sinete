// Verificações do @sinete/emissor compartilhadas por Node, Bun, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
// Cada emissor abre um PFX sintético, monta, assina e grava os bytes no store em memória antes de enviar. No browser
// não há mTLS, então lá ele só assina; nas outras runtimes, emite no simulador em processo com a conexão caindo depois
// do processamento (a consulta conclui com os bytes gravados, o aoDecidir recebe o desfecho e os bytes saem do store)
// e gera o PDF pelo @sinete/da importado sob demanda. Os documentos são os exemplos sintéticos das outras fixtures.
// No Deno com `npm:`, peer opcional só é resolvida quando está no grafo estático do app (ADR 0010): quem usa o
// emissor de um documento importa também o pacote dele, como faz com o @sinete/da. No Node, o import não muda nada.
import '@sinete/mdfe';
import '@sinete/nfe';
import '@sinete/nfse';
import { relogioManual } from '@sinete/core';
import * as daMdfe from '@sinete/da/mdfe';
import * as daNfe from '@sinete/da/nfe';
import * as daNfse from '@sinete/da/nfse';
import { destinoDosBytes, ErroTransmissaoEmAndamento } from '@sinete/emissor';
import { casosDoContrato } from '@sinete/emissor/contrato';
import { criarEmissorMdfe } from '@sinete/emissor/mdfe';
import { criarBancoMemoria, criarMemoriaStore } from '@sinete/emissor/memoria';
import { criarEmissorNfe } from '@sinete/emissor/nfe';
import { criarEmissorNfse } from '@sinete/emissor/nfse';
import {
  criarNfseSim,
  criarSefazSim,
  redirecionarNfseParaSim,
  redirecionarParaSim,
  URL_BASE_SIM,
  transporteSim,
  certificadoSintetico,
  pfxSintetico,
} from '@sinete/sefaz-sim';

const CNPJ = '11222333000181';
const CPF = '11144477735';
const SAO_PAULO = '3550308';

const nota = {
  serie: 1,
  nNF: 2,
  natOp: 'VENDA',
  tpNF: '1',
  emitente: {
    CNPJ,
    xNome: 'EMPRESA SINTETICA LTDA',
    endereco: { xLgr: 'RUA A', nro: '1', xBairro: 'CENTRO', cMun: SAO_PAULO, xMun: 'SAO PAULO', UF: 'SP', CEP: '01001000' },
    IE: '110042490114',
    CRT: '3',
  },
  destinatario: {
    CPF,
    xNome: 'X',
    indIEDest: '9',
    endereco: { xLgr: 'RUA B', nro: '2', xBairro: 'CENTRO', cMun: SAO_PAULO, xMun: 'SAO PAULO', UF: 'SP' },
  },
  itens: [
    {
      produto: { cProd: '1', xProd: 'ITEM', NCM: '73181500', CFOP: '5102', uCom: 'UN', qCom: '3', vUnCom: '3.3333' },
      impostos: { icms: { CST: '00', orig: '0', pICMS: '18' }, pis: { CST: '07' }, cofins: { CST: '07' } },
    },
  ],
  pagamento: { detPag: [{ tPag: '17', vPag: '10' }] },
};

const mdfe = {
  tpEmit: '2',
  serie: 920,
  nMDF: 2,
  emitente: {
    CPF,
    IE: '00130000019',
    xNome: 'PRODUTOR RURAL SINTETICO',
    endereco: { xLgr: 'RODOVIA FICTICIA', nro: 'KM 10', xBairro: 'ZONA RURAL', cMun: '5103403', xMun: 'CUIABA', UF: 'MT' },
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
      condutores: [{ xNome: 'CONDUTOR SINTETICO', CPF: '52998224725' }],
      tpRod: '01',
      tpCar: '03',
      UF: 'MT',
    },
  },
  descarregamentos: [
    { cMun: SAO_PAULO, xMun: 'SAO PAULO', nfe: [{ chave: '51260911222333000181550010000000011100000016' }] },
  ],
  produtoPredominante: { tpCarga: '01', xProd: 'SOJA EM GRAOS', NCM: '12019000' },
  totais: { vCarga: '150000', cUnid: '01', qCarga: '30000' },
};

const dps = {
  serie: '1',
  nDPS: '3',
  cLocEmi: SAO_PAULO,
  prestador: { CNPJ, regTrib: { opSimpNac: '3', regApTribSN: '1', regEspTrib: '0' } },
  tomador: { CNPJ: '44555666000181', xNome: 'TOMADOR SINTETICO LTDA' },
  servico: {
    local: { cLocPrestacao: SAO_PAULO },
    cTribNac: '01.01.01',
    xDescServ: 'Desenvolvimento de software (teste)',
    cNBS: '115021000',
  },
  valores: { vServ: '1500.00' },
  tributacao: { issqn: { tribISSQN: '1', tpRetISSQN: '1' }, totTrib: { pTotTribSN: '6.00' } },
};

export async function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const browser = typeof document !== 'undefined';
  // No Deno o módulo vai pela opção `da`, importado de forma estática: com `npm:`, o import sob demanda de dentro do
  // pacote só acha a peer dependency opcional se ela já estiver no grafo do app. Node e Bun testam o import sob demanda.
  const deno = typeof Deno !== 'undefined';

  expect(
    'política dos bytes',
    destinoDosBytes({ tipo: 'recusado', documento: 'nfe', id: 'x', cStat: '999', xMotivo: '' }, () => false) === 'descartar' &&
      destinoDosBytes({ tipo: 'pendente', documento: 'nfe', id: 'x', motivo: 'sem-resposta' }, () => false) === 'manter',
  );

  // A suíte de contrato roda contra o adaptador em memória: dois "processos" sobre o mesmo banco. O relógio é manual e
  // a espera o avança: com espera de verdade e prazo curto, o atraso do timer no Node reprovava a renovação.
  const relogioDoBanco = relogioManual('2026-09-26T10:00:00-03:00');
  const casos = casosDoContrato({
    criar: () => {
      const banco = criarBancoMemoria();
      return {
        a: criarMemoriaStore({ banco, relogio: relogioDoBanco }),
        b: criarMemoriaStore({ banco, relogio: relogioDoBanco }),
      };
    },
    esperar: async (ms) => {
      relogioDoBanco.avancar(ms);
    },
  });
  let contratoOk = casos.length > 0;
  for (const caso of casos) {
    try {
      await caso.rodar();
    } catch (e) {
      contratoOk = false;
      failures.push(`contrato: ${caso.nome}: ${e?.message ?? e}`);
    }
  }
  expect('contrato do store em memória', contratoOk);

  const clock = relogioManual('2026-09-26T10:00:00-03:00');
  const ac = await certificadoSintetico({ relogio: clock, papel: 'ac' });

  // NF-e
  {
    const titular = await certificadoSintetico({ relogio: clock, papel: 'titular', cnpj: CNPJ, emissor: ac });
    const sim = criarSefazSim({ relogio: clock });
    const store = criarMemoriaStore({ relogio: clock });
    const decididos = [];
    const nfe = await criarEmissorNfe({
      pfx: pfxSintetico(titular, 'senha-sintetica', { cadeia: [ac] }),
      senha: 'senha-sintetica',
      ambiente: 'homologacao',
      relogio: clock,
      store,
      aoDecidir: (registro, desfecho) => {
        decididos.push({ xml: registro.xml, desfecho });
      },
      transporte: () => redirecionarParaSim(transporteSim(sim, { certificadoDoCliente: titular.der }), URL_BASE_SIM),
      ...(deno ? { da: daNfe } : {}),
    });
    expect('nfe: titular do PFX', nfe.titular.cnpj === CNPJ);
    const a = await nfe.assinar(nota);
    expect('nfe: assina sem gravar', a.id.length === 44 && a.xml.includes('<Signature') && (await store.ler('nfe', 'n1')) === undefined);
    if (!browser) {
      sim.injetarFalha({ tipo: 'derrubar', fase: 'depois' }, { servico: 'NFeAutorizacao' });
      const d = await nfe.emitir('n1', nota);
      expect(
        'nfe: sem resposta resolvido pela consulta com os bytes gravados',
        d.tipo === 'autorizado' && decididos.length === 1 && d.proc.includes(decididos[0].xml),
      );
      expect('nfe: bytes concluídos', (await store.ler('nfe', 'n1')) === undefined);
      if (d.tipo === 'autorizado') {
        const pdf = await nfe.pdf(d.proc);
        expect('nfe: DANFE pelo @sinete/da', new TextDecoder().decode(pdf.subarray(0, 5)) === '%PDF-');
      }
    }
    const invalida = await nfe.emitir('n2', { ...nota, destinatario: undefined }).catch((e) => e);
    expect(
      'nfe: entrada inválida lança antes de gravar',
      invalida?.code === 'validacao_falhou' && (await store.ler('nfe', 'n2')) === undefined,
    );
    // Outro "processo" com a trava em vigor: nada vai à SEFAZ.
    const trava = await store.travar('nfe', 'n3', 60_000);
    const ocupado = await nfe.emitir('n3', nota).catch((e) => e);
    expect('nfe: trava em vigor', trava !== undefined && ocupado instanceof ErroTransmissaoEmAndamento);
    await nfe.fechar();
  }

  // MDF-e
  {
    const produtor = await certificadoSintetico({ relogio: clock, papel: 'titular', cpf: CPF, emissor: ac });
    const sim = criarSefazSim({ relogio: clock, uf: 'MT' });
    const decididos = [];
    const e = await criarEmissorMdfe({
      pfx: pfxSintetico(produtor, 'senha-sintetica', { cadeia: [ac] }),
      senha: 'senha-sintetica',
      ambiente: 'homologacao',
      relogio: clock,
      store: criarMemoriaStore({ relogio: clock }),
      aoDecidir: (registro, desfecho) => {
        decididos.push({ xml: registro.xml, desfecho });
      },
      transporte: () => redirecionarParaSim(transporteSim(sim, { certificadoDoCliente: produtor.der }), URL_BASE_SIM),
      ...(deno ? { da: daMdfe } : {}),
    });
    expect('mdfe: titular do PFX', e.titular.cpf === CPF);
    if (browser) {
      const a = await e.assinar(mdfe);
      expect('mdfe: assina no browser', a.id.length === 44 && a.xml.includes('<Signature'));
    } else {
      sim.injetarFalha({ tipo: 'derrubar', fase: 'depois' }, { servico: 'MDFeRecepcaoSinc' });
      const d = await e.emitir('m1', mdfe);
      expect(
        'mdfe: sem resposta resolvido pela consulta',
        d.tipo === 'autorizado' && decididos.length === 1 && d.proc.includes(decididos[0].xml),
      );
      if (d.tipo === 'autorizado') {
        const pdf = await e.pdf(d.proc);
        expect('mdfe: DAMDFE pelo @sinete/da', new TextDecoder().decode(pdf.subarray(0, 5)) === '%PDF-');
      }
    }
    await e.fechar();
  }

  // NFS-e
  {
    const [servidor, titular] = await Promise.all([
      certificadoSintetico({ relogio: clock, papel: 'servidor', emissor: ac }),
      certificadoSintetico({ relogio: clock, papel: 'titular', cnpj: CNPJ, emissor: ac }),
    ]);
    const sim = criarNfseSim({
      relogio: clock,
      assinador: servidor.assinador,
      municipios: [
        {
          cMun: SAO_PAULO,
          nome: 'São Paulo',
          servicos: [{ codigo: '01.01.01', aliquotas: [{ aliquota: '2.00', inicio: '2026-01-01' }] }],
        },
      ],
    });
    const decididos = [];
    const e = await criarEmissorNfse({
      pfx: pfxSintetico(titular, 'senha-sintetica', { cadeia: [ac] }),
      senha: 'senha-sintetica',
      ambiente: 'homologacao',
      relogio: clock,
      store: criarMemoriaStore({ relogio: clock }),
      aoDecidir: (registro, desfecho) => {
        decididos.push({ id: registro.id, desfecho });
      },
      transporte: () => redirecionarNfseParaSim(transporteSim(sim, { certificadoDoCliente: titular.der }), URL_BASE_SIM),
      ...(deno ? { da: daNfse } : {}),
    });
    expect('nfse: titular do PFX', e.titular.cnpj === CNPJ);
    if (browser) {
      const a = await e.assinar(dps);
      expect('nfse: assina no browser', a.id.startsWith('DPS') && a.xml.includes('<Signature'));
    } else {
      sim.injetarFalha({ tipo: 'derrubar', fase: 'depois' }, { rota: 'emitir' });
      const d = await e.emitir('s1', dps);
      expect(
        'nfse: sem resposta resolvido pela consulta da DPS',
        d.tipo === 'autorizado' && decididos.length === 1 && d.id === decididos[0].id,
      );
      if (d.tipo === 'autorizado') {
        const pdf = await e.pdf(d.proc);
        expect('nfse: DANFSe local pelo @sinete/da', new TextDecoder().decode(pdf.subarray(0, 5)) === '%PDF-');
      }
    }
    await e.fechar();
  }
  return failures;
}
