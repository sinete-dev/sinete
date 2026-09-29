// Verificações do @sinete/ibs-cbs-dados compartilhadas por Node, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
import { diffDatasets, loadDataset, IbsCbsDataError, verifyDataset } from '@sinete/ibs-cbs-dados';
import { BUNDLED_DATASET, bundledDataset } from '@sinete/ibs-cbs-dados/bundled';

export async function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };
  const ds = bundledDataset();
  expect('contentVersion', /^\d{4}\.\d{2}\+V\d{4}/.test(ds.contentVersion));
  const at = ds.at('2026-10-10');
  const rice = at.classTrib('200003');
  expect('cClassTrib vigente', rice?.cst === '200' && at.reduction(rice, 'CBS') === '100');
  expect('NCM do Anexo I', rice !== undefined && at.applicableNcm(rice, '10063021').result === 'yes');
  expect('fora de vigência', at.classTrib('220001') === undefined);
  await verifyDataset(BUNDLED_DATASET);
  expect('diff vazio', diffDatasets(BUNDLED_DATASET, BUNDLED_DATASET).unchanged.length === ds.manifest.tables.length);
  try {
    loadDataset({ manifest: {}, tables: {} });
    failures.push('bundle inválido aceito');
  } catch (e) {
    expect('erro tipado', e instanceof IbsCbsDataError && e.code === 'ibscbs_dados_invalidos');
  }
  return failures;
}
