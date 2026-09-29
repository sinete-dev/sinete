// Entrada do bundle de isolamento da smoke: quem importa só @sinete/da/nfse não leva o layout nem o schema da NF-e.
import { danfse, toPdf } from '@sinete/da/nfse';

globalThis.__da = { danfse, toPdf };
