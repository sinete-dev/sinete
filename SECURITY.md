# Segurança

O sinete assina documentos fiscais e fala com a SEFAZ usando o certificado digital do contribuinte. Uma falha aqui pode significar documento assinado sem autorização, chave privada exposta ou nota emitida em nome de outro. Tratamos esses relatos com prioridade.

## Como reportar

**Não abra issue pública para vulnerabilidade.** Use o reporte privado do GitHub: aba **Security** do repositório, botão **Report a vulnerability**. O relato fica visível só para os mantenedores.

Inclua:

- pacote e versão afetados;
- descrição do problema e do impacto;
- passos para reproduzir, com dados **sintéticos**.

Respondemos em até 5 dias úteis com a avaliação inicial e combinamos o prazo de correção e de divulgação. Quem reportar recebe crédito no aviso, se quiser.

## Nunca anexe dados reais

Em relatos, issues, PRs e discussões, **nunca envie**:

- certificado digital (PFX, P12, PEM com chave privada), senha ou PIN, mesmo de certificado vencido ou de homologação;
- XML autorizado de contribuinte real, DANFE, chave de acesso de nota real;
- CPF, CNPJ, inscrição estadual, endereço ou qualquer dado pessoal ou fiscal de terceiros.

Se precisar de um documento para reproduzir, gere um sintético em homologação ou anonimize todos os campos de identificação. Se um dado real for enviado por engano, avisamos e apagamos o conteúdo, mas o certificado exposto deve ser revogado pelo titular junto à autoridade certificadora.

## Escopo

Entram: assinatura e verificação de XML (XMLDSig, C14N), leitura de PFX e tratamento de chave, transporte mTLS e validação de cadeia, o helper `sinete-signer` (política de hosts, assinatura delegada), a CLI e qualquer caminho em que dado do documento ou material de chave possa vazar para log, erro ou rede.

Fora: rejeições da SEFAZ por regra fiscal (abra issue normal), vulnerabilidades em dependências já públicas sem impacto específico no sinete (reporte ao projeto de origem).

## Versões suportadas

Antes da 1.0, só a versão mais recente de cada pacote recebe correção de segurança.
