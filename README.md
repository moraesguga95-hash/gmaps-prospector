# Google Maps Prospector

Aplicacao React que exibe leads coletados pelo scraper do GitHub Actions. O acesso ao banco usa Supabase Auth e Row Level Security (RLS): cada usuario autenticado so pode acessar linhas cujo `user_id` seja o seu proprio ID.

## Configuracao segura

1. No Supabase Auth, crie o usuario que acessara o painel e copie seu UUID.
2. Execute `supabase/migrations/20260903000000_secure_leads_rls.sql` no projeto Supabase.
3. Depois da migration, associe dados legados ao usuario pelo SQL Editor (substitua o UUID):

```sql
update public.leads
set user_id = 'UUID-DO-USUARIO'
where user_id is null;
```

4. Na Vercel, configure:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (pode ser exposta ao navegador; o RLS limita os dados)
5. Nos secrets do GitHub Actions, configure:
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY` (somente server-side; nunca use prefixo `VITE_`)
   - `SUPABASE_OWNER_USER_ID` (o UUID do usuario acima)
6. Remova o secret antigo `SUPABASE_KEY` depois de confirmar que o workflow novo funciona.

Copie `.env.example` para `.env.local` no desenvolvimento e nunca versione valores reais.

## Validacao

```bash
npm ci
npm run lint
npm run build
```

Para verificar a conexao server-side, configure as tres variaveis `SUPABASE_*` e execute `node check-db.cjs`. No Supabase, use o RLS Tester para confirmar que:

- `anon` nao le, insere, altera ou apaga leads;
- um usuario autenticado acessa apenas seu proprio `user_id`;
- alterar `user_id` durante um update e bloqueado;
- o scraper cria registros com `SUPABASE_OWNER_USER_ID`.

## Modelo de seguranca

O frontend usa apenas a chave publishable e a sessao do usuario. O scraper e o servidor auxiliar usam a chave secret exclusivamente em ambientes controlados. A chave secret ignora RLS, portanto todas as operacoes server-side tambem filtram ou preenchem explicitamente `user_id`.