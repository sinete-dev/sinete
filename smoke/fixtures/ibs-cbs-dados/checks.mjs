// Verificações do @sinete/ibs-cbs-dados compartilhadas por Node, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
import { compararDatasets, carregarDataset, ErroDadosIbsCbs, conferirDataset } from '@sinete/ibs-cbs-dados';
import { DATASET_EMBARCADO, datasetEmbarcado } from '@sinete/ibs-cbs-dados/embarcado';

export async function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const ds = datasetEmbarcado();
  expect('versaoDoConteudo', /^\d{4}\.\d{2}\+V\d{4}/.test(ds.versaoDoConteudo));
  const at = ds.em('2026-10-10');
  const rice = at.classTrib('200003');
  expect('cClassTrib vigente', rice?.cst === '200' && at.reducao(rice, 'CBS') === '100');
  expect('NCM do Anexo I', rice !== undefined && at.ncmAplicavel(rice, '10063021').resultado === 'sim');
  expect('fora de vigência', at.classTrib('220001') === undefined);
  await conferirDataset(DATASET_EMBARCADO);
  expect('diff vazio', compararDatasets(DATASET_EMBARCADO, DATASET_EMBARCADO).inalteradas.length === ds.manifesto.tabelas.length);
  try {
    carregarDataset({ manifesto: {}, tabelas: {} });
    failures.push('bundle inválido aceito');
  } catch (e) {
    expect('erro tipado', e instanceof ErroDadosIbsCbs && e.code === 'ibscbs_dados_invalidos');
  }
  return failures;
}
