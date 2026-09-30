# Códigos de erro

Gerado do fonte por `scripts/docs-gerados.ts`; não edite à mão. Todo erro lançado pelo sinete é um `ErroSinete` com `code` estável e `pagina`, o caminho da página do código nesta pasta (`erros/<code>.md`). Decida pelo `code` (ou por `ehErroSinete(e, code)`), nunca pela mensagem. Rejeição da SEFAZ não é erro lançado: é desfecho (`tipo: 'recusado'`, no cliente e no emissor), e o catálogo de rejeições é o `@sinete/rejeicoes`.

## `@sinete/cert`

- [`algoritmo_nao_suportado`](algoritmo_nao_suportado.md) (`CertError`): a chave ou o hash não é o que os DF-e usam
- [`certificado_ainda_nao_valido`](certificado_ainda_nao_valido.md) (`CertError`): o certificado ainda não começou a valer
- [`certificado_expirado`](certificado_expirado.md) (`CertError`): o certificado já venceu
- [`certificado_invalido`](certificado_invalido.md) (`CertError`): o certificado ou a chave não é um DER válido
- [`pfx_invalido`](pfx_invalido.md) (`CertError`): o arquivo não é um PFX legível
- [`pfx_nao_suportado`](pfx_nao_suportado.md) (`CertError`): o PFX usa uma cifra que o leitor não implementa
- [`pfx_sem_certificado_da_chave`](pfx_sem_certificado_da_chave.md) (`CertError`): nenhum certificado do PFX é da chave
- [`pfx_sem_chave`](pfx_sem_chave.md) (`CertError`): o PFX não tem chave privada
- [`pfx_senha_incorreta`](pfx_senha_incorreta.md) (`CertError`): a senha não abriu o PFX

## `@sinete/core`

- [`config_invalida`](config_invalida.md) (`ErroDeConfiguracao`): opção ou argumento fora do domínio
- [`nao_suportado`](nao_suportado.md) (`ErroNaoSuportado`): a runtime não suporta o que foi pedido
- [`resposta_invalida`](resposta_invalida.md) (`ErroRespostaInvalida`): a resposta não segue o leiaute esperado
- [`sefaz_denegou`](sefaz_denegou.md) (`ErroSefaz`): uso denegado e o código pediu o valor autorizado
- [`sefaz_pendente`](sefaz_pendente.md) (`ErroSefaz`): o documento ainda está em processamento e o código pediu o valor autorizado
- [`sefaz_rejeitou`](sefaz_rejeitou.md) (`ErroSefaz`): a SEFAZ rejeitou e o código pediu o valor autorizado
- [`servico_nao_oferecido`](servico_nao_oferecido.md) (`ErroServicoNaoOferecido`): o autorizador não oferece esse serviço
- [`tempo_esgotado`](tempo_esgotado.md) (`ErroDeTempoEsgotado`): a operação passou do prazo
- [`validacao_falhou`](validacao_falhou.md) (`ErroDeValidacao`): a entrada ou o documento montado não passou na validação local
- [`xml_malformado`](xml_malformado.md) (`ErroXml`): o XML não é bem formado
- [`xmldsig_falhou`](xmldsig_falhou.md) (`ErroAssinaturaXml`): não foi possível assinar o XML

## `@sinete/da`

- [`campo_ausente`](campo_ausente.md) (`DanfeError`): falta um grupo obrigatório para o documento auxiliar
- [`codigo_barras_invalido`](codigo_barras_invalido.md) (`DanfeError`): o conteúdo não cabe no código de barras
- [`documento_inesperado`](documento_inesperado.md) (`DanfeError`): o XML é de outro documento
- [`evento_incompativel`](evento_incompativel.md) (`DanfeError`): o evento não é da nota ou não é o esperado
- [`formato_incompativel`](formato_incompativel.md) (`DanfeError`): o formato pedido não se aplica ao modelo
- [`imagem_invalida`](imagem_invalida.md) (`DanfeError`): o logotipo não é PNG nem JPEG legível
- [`xml_invalido`](xml_invalido.md) (`DanfeError`): o XML do documento auxiliar é malformado

## `@sinete/emissor`

- [`contrato_violado`](contrato_violado.md) (`ContratoVioladoError`): o adaptador do store não cumpre o contrato
- [`recusa_repetida`](recusa_repetida.md) (`RecusaRepetidaError`): a mesma nota já foi recusada pela SEFAZ o limite de vezes
- [`transmissao_em_andamento`](transmissao_em_andamento.md) (`TransmissaoEmAndamentoError`): outro processo está transmitindo este documento
- [`transmissao_ja_gravada`](transmissao_ja_gravada.md) (`TransmissaoJaGravadaError`): já há bytes gravados para o documento
- [`trava_perdida`](trava_perdida.md) (`TravaPerdidaError`): a trava venceu antes de o emissor terminar

## `@sinete/ibs-cbs`

- [`ibscbs_aliquota_desconhecida`](ibscbs_aliquota_desconhecida.md) (`RateUnknownError`): a alíquota ainda não foi publicada
- [`ibscbs_aliquotas_invalidas`](ibscbs_aliquotas_invalidas.md) (`RatesDataError`): tabela de alíquotas malformada
- [`ibscbs_classificacao_invalida`](ibscbs_classificacao_invalida.md) (`ClassificationError`): a classificação do IBS/CBS não é aceita pelos dados oficiais
- [`ibscbs_determinacao_invalida`](ibscbs_determinacao_invalida.md) (`DeterminationError`): a determinação do CST e do cClassTrib não pode seguir
- [`ibscbs_expressao_invalida`](ibscbs_expressao_invalida.md) (`ExpressionError`): expressão de cálculo do dataset fora da gramática
- [`ibscbs_regime_nao_suportado`](ibscbs_regime_nao_suportado.md) (`UnsupportedRegimeError`): o motor ainda não calcula este regime

## `@sinete/ibs-cbs-dados`

- [`ibscbs_dados_invalidos`](ibscbs_dados_invalidos.md) (`IbsCbsDataError`): o bundle de dados do IBS/CBS não confere
- [`ibscbs_dados_versao_incompativel`](ibscbs_dados_versao_incompativel.md) (`IbsCbsDataError`): o formato do dataset não é o que o código lê

## `@sinete/schemas`

- [`pl_sem_vigencia`](pl_sem_vigencia.md) (`VigenciaError`): nenhum leiaute vigente para a data e o ambiente
- [`serializacao_invalida`](serializacao_invalida.md) (`SerializeError`): o valor não serializa no tipo do XSD

## `@sinete/transport`

- [`assinatura_documento_recusada`](assinatura_documento_recusada.md) (`SignerError`): o helper recusou assinar o documento
- [`assinatura_tls_expirou`](assinatura_tls_expirou.md) (`SignerError`): quem assina não respondeu a tempo
- [`assinatura_tls_recusada`](assinatura_tls_recusada.md) (`SignerError`): quem assina recusou o handshake
- [`cadeia_servidor_nao_confiavel`](cadeia_servidor_nao_confiavel.md) (`TransportError`): o certificado do servidor não fecha numa raiz confiável
- [`cancelado`](cancelado.md) (`TransportError`): o envio foi cancelado pelo chamador
- [`certificado_ausente_ou_recusado`](certificado_ausente_ou_recusado.md) (`TransportError`): recusa do certificado sem distinguir ausência de recusa
- [`certificado_nao_apresentado`](certificado_nao_apresentado.md) (`TransportError`): o servidor pediu o certificado e não recebeu
- [`certificado_nao_carregado`](certificado_nao_carregado.md) (`TransportError`): a identidade não entrou no contexto TLS
- [`certificado_recusado`](certificado_recusado.md) (`TransportError`): o servidor recebeu o certificado e recusou
- [`conexao_recusada`](conexao_recusada.md) (`TransportError`): o servidor fechou ou recusou a conexão
- [`falha_rede`](falha_rede.md) (`TransportError`): falha de rede
- [`falha_tls`](falha_tls.md) (`TransportError`): outra falha de TLS
- [`nome_servidor_divergente`](nome_servidor_divergente.md) (`TransportError`): o certificado do servidor é de outro host
- [`pkcs11_falhou`](pkcs11_falhou.md) (`SignerError`): o token PKCS#11 falhou
- [`politica_recusou`](politica_recusou.md) (`PolicyError`): a política de hosts recusou o envio
- [`signer_indisponivel`](signer_indisponivel.md) (`SignerError`): o helper sinete-signer não está disponível
- [`signer_protocolo`](signer_protocolo.md) (`SignerError`): o helper respondeu fora do contrato
