# Nosso Treino — Evoluindo juntos

Plataforma responsiva de treinos para casal, criada a partir da ficha ABC do Treinador David.

**Site público:** https://nosso-treino-juntos-2026.samuelsillas97.chatgpt.site

## Funcionalidades

- 36 exercícios de segunda a sexta, na ordem da ficha original.
- Dois perfis com nomes editáveis e acompanhamento independente.
- Modo casal, checklist por série, registro de cargas e observações.
- Cronômetro de descanso configurável, progresso semanal e histórico.
- Salvamento no navegador e exportação/restauração de backup JSON.
- Instruções educativas e ilustrações alternativas ampliáveis.

## Executar

O projeto usa HTML, CSS e JavaScript puro, sem dependências de execução ou etapa de build. Sirva esta pasta com qualquer servidor estático e abra `index.html` no navegador. Por exemplo, com Python instalado:

```sh
python -m http.server 8080
```

Acesse http://localhost:8080. Também é possível hospedar estes arquivos em qualquer serviço de sites estáticos.

## Arquivos

- `index.html`: estrutura e navegação.
- `style.css`: identidade visual e responsividade.
- `data.js`: ficha transcrita e orientações complementares.
- `app.js`: perfis, sessões, armazenamento local e cronômetro.
- `ficha-original.pdf`: documento de referência.

## Dados e limitações

Os registros pessoais ficam em `localStorage`, neste navegador e nesta origem. Não há banco de dados, login individual ou sincronização entre dispositivos. Exporte backups no Histórico antes de limpar os dados do navegador ou mudar de dispositivo/endereço.

A ficha contém um único programa, utilizado pelos dois perfis. Valores ausentes são identificados como não informados. O intervalo geral de 60–90 segundos foi preservado.

As demonstrações são esquemas autorais simplificados, não GIFs de execução real. Confirme equipamentos e variantes não especificados com o treinador. As orientações educativas complementares são distintas da prescrição original. Interrompa a execução em caso de dor ou desconforto.

## Verificação realizada

Sintaxe JavaScript, persistência após recarregar, separação dos perfis, modo casal, conclusão e histórico, ampliação/pausa das ilustrações e inspeção do layout em 390 px.

Não inclui dados pessoais de treino, credenciais ou arquivos internos de hospedagem.
