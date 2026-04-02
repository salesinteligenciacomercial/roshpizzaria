
Objetivo: corrigir o “falso espaço cheio” sem migrar agora, ampliando a aba de Configurações Avançadas para limpar o que realmente incha o banco e impedindo novo acúmulo.

Diagnóstico do código atual
- A aba existente `StorageCleanup` limpa apenas arquivos órfãos no bucket `conversation-media`.
- O texto da tela hoje induz ao erro: fala em “liberar espaço no banco”, mas a função atual só trata storage de arquivos.
- O inchaço falso citado no histórico vem principalmente de:
  1. registros de `cron.job_run_details`
  2. registros de `net._http_response`
  3. bloat/dead space de tabelas grandes como `conversas`
- Já existem cron jobs configurados em migrations com `net.http_post(...)`, o que explica crescimento contínuo dessas tabelas internas.
- Há precedente no projeto de usar `SUPABASE_DB_URL` dentro de edge function (`setup-funil`), então dá para seguir o mesmo padrão para manutenção administrativa.

O que vou planejar implementar
1. Separar “limpeza de arquivos” de “manutenção do banco”
- Manter `StorageCleanup` para arquivos órfãos.
- Adicionar um novo card na aba avançada, algo como “Saúde do Banco”.
- Mostrar métricas separadas:
  - arquivos órfãos
  - logs internos antigos
  - respostas HTTP antigas
  - tamanho estimado recuperável
  - status geral de risco

2. Criar uma nova edge function administrativa para manutenção real do banco
- Nova função com autenticação obrigatória e restrição a `super_admin`/`company_admin`.
- Usar `SUPABASE_DB_URL` para executar SQL administrativo de leitura e limpeza.
- Ações previstas:
  - `analyze`: medir tamanho de `cron.job_run_details`, `net._http_response` e tabelas grandes
  - `cleanup_logs`: apagar logs antigos por janela segura
  - `vacuum_targeted`: executar `VACUUM ANALYZE` em tabelas críticas permitidas
  - `full_maintenance`: rodar limpeza + vacuum leve
- Não mexer em schemas reservados com triggers; apenas manutenção/consulta segura.

3. Aplicar política de retenção para evitar novo inchaço
- Limpar somente registros antigos, por exemplo:
  - `cron.job_run_details` acima de X dias
  - `net._http_response` acima de X dias
- Expor isso na UI com opções simples e seguras:
  - 7 dias
  - 15 dias
  - 30 dias
- Assim o sistema para de exigir “recargas” desnecessárias só por lixo operacional.

4. Melhorar a UX da área avançada
- Deixar claro na UI a diferença entre:
  - Espaço real do app
  - Espaço desperdiçado por logs/cache interno
- Adicionar avisos como:
  - “Esta limpeza não apaga conversas, leads ou clientes”
  - “Remove apenas resíduos operacionais e arquivos sem uso”
- Exibir resultado da limpeza com números antes/depois.

5. Tornar a manutenção recorrente
- Depois da limpeza manual funcionar, adicionar rotina automática periódica para retenção dos logs internos.
- Isso evita que o falso crescimento volte e impacte envio/recebimento de mensagens.

Fluxo proposto
```text
Configurações > Avançado
├─ Gerenciamento de Armazenamento
│  └─ arquivos órfãos do storage
└─ Saúde do Banco
   ├─ analisar uso real vs lixo operacional
   ├─ limpar logs internos antigos
   ├─ executar manutenção segura
   └─ mostrar espaço recuperado
```

Arquivos que provavelmente serão ajustados
- `src/components/configuracoes/StorageCleanup.tsx`
- `src/pages/Configuracoes.tsx`
- nova edge function de manutenção administrativa do banco
- possivelmente configuração de função em `supabase/config.toml`

Detalhes técnicos
- A função atual `cleanup-storage` não resolve `cron.job_run_details` nem `net._http_response`.
- O projeto já tem `SUPABASE_DB_URL` configurada e exemplo de uso em `supabase/functions/setup-funil/index.ts`.
- Como o problema é operacional e não de dados de negócio, a correção ideal é:
  - analisar tabelas internas
  - apagar histórico antigo
  - fazer manutenção leve recorrente
- Isso ataca o “falso cheio” sem precisar migrar agora.

Resultado esperado
- Reduzir rapidamente o espaço inflado por lixo operacional.
- Parar o crescimento artificial que bloqueia mensagens.
- Aproveitar melhor os 25 GB disponíveis.
- Usar a aba de Configurações Avançadas para manutenção real, não só limpeza de arquivos.
