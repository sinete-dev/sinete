---
'@sinete/emissor': patch
---

A suíte de contrato do `TransmissaoStore` renova a trava a cada terço do prazo, não a cada metade, no caso "renovar estende a trava em vigor": com espera de verdade, o atraso do timer ou do banco reprovava adaptador certo. O caso continua passando do prazo original e reprovando o adaptador que não estende a trava.
