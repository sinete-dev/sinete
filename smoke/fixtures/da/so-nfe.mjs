// Entrada de comparação do bundle de isolamento da smoke: o DANFE da NF-e com tudo o que ele usa.
import { danfe, gerarPdf } from '@sinete/da/nfe';

globalThis.__da = { danfe, gerarPdf: gerarPdf };
