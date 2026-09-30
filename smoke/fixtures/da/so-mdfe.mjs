// Entrada do bundle de isolamento da smoke: quem importa só @sinete/da/mdfe não leva o layout nem o schema da NF-e.
import { damdfe, gerarPdf } from '@sinete/da/mdfe';

globalThis.__da = { damdfe, gerarPdf: gerarPdf };
