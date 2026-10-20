# Nosso Treino — Evoluindo juntos

Aplicativo de musculação para casal, adaptado da nova interface enviada pelo usuário e da ficha real do Treinador David.

**Site público:** https://nosso-treino-juntos-2026.samuelsillas97.chatgpt.site

## Usar em dois celulares

1. No primeiro aparelho, abra **Conectar → Criar espaço do casal**. Confirme o envio dos registros locais.
2. Toque em **Mostrar código do casal** e compartilhe o código somente com a outra pessoa.
3. No segundo aparelho, abra **Conectar**, cole o código e toque em **Conectar ao casal**.
4. Cada integrante escolhe seu perfil em **Treino**.

Quem possui o código pode ler e alterar os registros do casal. Não há login individual nem recuperação por e-mail. O site é público; os dados compartilhados dependem da chave privada de 128 bits, cujo hash SHA-256 é armazenado no servidor. O código não entra no GitHub ou no backup exportado.

## Funcionalidades

- Ficha real: 36 exercícios, cinco dias, com variações **A-volume** na quinta e **B-core** na sexta, sem substituir o programa por um ABC genérico.
- Treino do dia, escolha de pessoa e treino, séries com carga e quantidade anteriores preenchidas.
- Sequência 12–10–8–6 por série, repetições por lado e prancha em segundos preservadas.
- Descanso automático, +15/−15 segundos, pular, bip e vibração quando suportados; solicitação de tela acesa durante o treino.
- Recorde de carga em relação aos dias anteriores, metas por pessoa e do casal, histórico e gráfico acessível com tabela de valores.
- Ficha, nomes, metas e descanso editáveis; notas e rascunhos de séries salvos no aparelho.
- Backup por texto com validação e confirmação antes de substituir dados.
- Migração automática dos registros locais compatíveis das versões anteriores, mantendo as chaves antigas intactas.
- Sincronização em D1, fila de alterações sem conexão, reenvio idempotente, isolamento entre casais e combinação por registro.
- Tema automático, claro ou escuro, interface móvel e botões grandes.

## Sincronização e limites

O cliente consulta alterações a cada 10 segundos enquanto aberto, e após uma edição. Sem internet, os registros continuam no navegador e ficam na fila até o retorno da conexão. Isto não é um PWA: o primeiro carregamento e uma recarga offline não são garantidos.

Edições em séries distintas são combinadas. Na mesma série ou configuração prevalece o último envio ao servidor. O segundo aparelho pode importar registros ainda ausentes; nomes e ficha do espaço conectado têm prioridade. Desconectar preserva a cópia local e não apaga os dados do banco.

No primeiro uso, informe a carga (0 para peso corporal). A contagem é inicialmente preenchida com o início da faixa prescrita e pode ser ajustada ao realizado. As séries concluídas precisam ser desmarcadas para edição. Um dia de treino conta uma vez por pessoa na meta semanal.

As orientações educativas complementam o PDF em `public/ficha-original.pdf`. Variantes não especificadas exigem confirmação com o treinador. As demonstrações incluem 35 GIFs em duas posições fotografadas e uma postura estática para a prancha, com pausa, ampliação e visualização lado a lado. São sequências de duas posições, não gravações contínuas nem animações anatômicas 3D. Não há modo PWA. Wake Lock, som e vibração dependem do navegador, do aparelho e da permissão do sistema; uma aba suspensa pode atrasar o aviso do descanso até ser retomada.

## Desenvolvimento

Node.js >=22.13.0. Vinext/Vite e Cloudflare Workers, com D1 e Drizzle. Mantenha `.openai/hosting.json` ao publicar no Sites.

```sh
npm run install:ci
node scripts/embed-page.mjs
npm run build
```

Prepare o banco local uma vez por migração pendente:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_perfect_shen.sql
npm run dev -- --port 5173 --hostname 127.0.0.1
```

`npm run db:generate` gera novas migrações após mudar `db/schema.ts`. Migrações aplicadas são imutáveis. O Sites aplica as migrações de produção na publicação. Para hospedar fora do Sites, configure seu próprio binding D1 e aplique as migrações; apenas subir os arquivos como site estático não ativa o servidor.

## Organização

- `ui/index.html` → `ui/page-html.ts`: HTML da página, gerado com `scripts/embed-page.mjs`.
- `public/app.js`, `style.css`, `data.js`, `model.js`: interface, ficha e validação compartilhada.
- `app/route.ts`: página principal; `app/api/sync/route.ts`: API.
- `lib/sync-server.mjs`: autenticação por chave, validação e sincronização.
- `db/schema.ts`, `drizzle/`: esquema e migrações D1.
- `tests/sync.test.mjs`: testes com SQLite real.

## Verificação

```sh
node --test tests/sync.test.mjs
```

Testes de dois clientes, isolamento, reenvio, exclusões lógicas, alterações pendentes, validação de backup, faixas e sequência de repetições. Teste de interface realizado com duas origens locais independentes, registro/descanso, persistência, sincronização de carga, conclusão, histórico, restauração, carga anterior preenchida, recorde e gráfico.

Nenhum dado pessoal de treino, código de acesso, banco local ou credencial faz parte do repositório.

## Demonstrações visuais

Fontes: yuhonas/free-exercise-db, distribuído pelo projeto como domínio público/Unlicense. As fotos foram mantidas sem recorte ou alteração da postura. Os GIFs alternam os dois quadros originais, a cada 1100 ms; esse intervalo é ilustrativo e não prescreve cadência. A prancha usa a foto da sustentação estática, sem movimento artificial.

Os 36 mapeamentos, incluindo avisos de variante e equipamento não informado, estão em public/demos.json; fontes e licença estão em public/demos/sources.json e SOURCE-LICENSE.txt. Imagens locais, carregamento sob demanda, pausa real capturando o quadro exibido e respeito à preferência de movimento reduzido. Para regenerar: node scripts/prepare-demos.mjs (requer acesso à fonte).
