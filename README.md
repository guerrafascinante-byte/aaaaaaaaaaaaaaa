# 🚀 Lovable Pro Extension

Extensão Chrome para usar o Lovable.dev com sistema de licenças próprio, usando **Vercel** para APIs serverless e **Supabase** para banco de dados.

## 📋 Funcionalidades

- ✅ Sistema de licenças próprio (Trial, Ilimitado, Customizado)
- ✅ Proxy reverso para API do Lovable
- ✅ Sincronização de histórico de conversas
- ✅ Modo Chat Only (sem modificar código)
- ✅ Interface moderna e responsiva
- ✅ Autenticação JWT segura
- ✅ Logs de uso e estatísticas

## 🏗️ Arquitetura

```
Frontend (Extensão Chrome)
    ↓
APIs Vercel (Serverless)
    ↓
Banco Supabase (PostgreSQL)
    ↓
API Lovable.dev
```

## 📦 Estrutura do Projeto

```
lovable-extension/
├── extension/              # Código da extensão Chrome
│   ├── manifest.json      # Configuração da extensão
│   ├── popup.html         # Interface principal
│   ├── popup.js           # Lógica da extensão
│   ├── background.js      # Service worker
│   ├── styles.css         # Estilos
│   └── icons/             # Ícones
│
├── api/                   # APIs Vercel
│   ├── auth.js           # Autenticação de licenças
│   ├── proxy.js          # Proxy para Lovable
│   └── sync.js           # Sincronização de histórico
│
├── supabase-setup.sql    # Script de configuração do banco
├── package.json          # Dependências Node.js
├── vercel.json           # Configuração Vercel
└── README.md             # Este arquivo
```

## 🚀 Como Instalar e Configurar

### Passo 1: Configurar o Banco de Dados Supabase

1. Acesse seu projeto Supabase: https://supabase.com/dashboard/project/aypdymvyiunbsyxfwisc

2. Vá em **SQL Editor** no menu lateral

3. Copie todo o conteúdo do arquivo `supabase-setup.sql`

4. Cole no editor SQL e clique em **Run**

5. Verifique se as tabelas foram criadas:
   - `licenses`
   - `chat_history`
   - `usage_logs`

6. Anote as credenciais (você já tem):
   - **URL**: `https://aypdymvyiunbsyxfwisc.supabase.co`
   - **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **Service Role Key**: Vá em **Settings → API** e copie a `service_role` key

### Passo 2: Configurar o Vercel

1. Instale o Vercel CLI:
```bash
npm install -g vercel
```

2. Faça login no Vercel:
```bash
vercel login
```

3. Entre na pasta do projeto:
```bash
cd lovable-extension
```

4. Instale as dependências:
```bash
npm install
```

5. Configure as variáveis de ambiente no Vercel:
```bash
vercel env add SUPABASE_URL
# Cole: https://aypdymvyiunbsyxfwisc.supabase.co

vercel env add SUPABASE_SERVICE_ROLE_KEY
# Cole a Service Role Key do Supabase

vercel env add JWT_SECRET
# Cole uma string aleatória de 32+ caracteres
# Exemplo: openssl rand -base64 32
```

6. Faça o deploy:
```bash
vercel --prod
```

7. Anote a URL do projeto (ex: `https://lovable-extension.vercel.app`)

### Passo 3: Configurar a Extensão

1. Abra o arquivo `extension/popup.js`

2. Na linha 2, altere a URL da API:
```javascript
const API_BASE_URL = 'https://SEU-PROJETO.vercel.app/api';
```

3. Salve o arquivo

### Passo 4: Instalar a Extensão no Chrome

1. Abra o Chrome e vá para `chrome://extensions/`

2. Ative o **Modo desenvolvedor** (canto superior direito)

3. Clique em **Carregar sem compactação**

4. Selecione a pasta `extension` dentro do projeto

5. A extensão será instalada e aparecerá na barra de ferramentas

### Passo 5: Criar Licenças de Teste

Execute no SQL Editor do Supabase:

```sql
-- Licença Trial (10 mensagens)
INSERT INTO licenses (license_key, name, plan_type, is_active, max_requests_day)
VALUES ('TRIAL-TEST-2024-0001', 'Teste Trial', 'trial', true, 10);

-- Licença Ilimitada (30 dias)
INSERT INTO licenses (license_key, name, plan_type, is_active, expires_at, max_requests_day)
VALUES (
  'UNLIM-TEST-2024-0001', 
  'Teste Ilimitado', 
  'unlimited', 
  true, 
  now() + interval '30 days',
  999999
);
```

### Passo 6: Testar a Extensão

1. Clique no ícone da extensão na barra do Chrome

2. Digite uma das chaves de licença criadas:
   - `TRIAL-TEST-2024-0001` (Trial)
   - `UNLIM-TEST-2024-0001` (Ilimitado)

3. Clique em **Ativar Licença**

4. Abra um projeto no Lovable.dev

5. Digite uma mensagem na extensão e clique em **Enviar**

6. Verifique se a mensagem foi enviada com sucesso

## 🔑 Gerando Novas Licenças

Para criar novas licenças, execute no Supabase:

```sql
-- Gerar chave aleatória
SELECT 
  UPPER(
    SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4) || '-' ||
    SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4) || '-' ||
    SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4) || '-' ||
    SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)
  ) as license_key;

-- Inserir nova licença
INSERT INTO licenses (license_key, name, plan_type, is_active, expires_at, max_requests_day)
VALUES ('CHAVE-GERADA-ACIMA', 'Nome do Cliente', 'unlimited', true, now() + interval '30 days', 999999);
```

## 📊 Monitoramento

### Ver Estatísticas de Uso

```sql
-- Licenças ativas
SELECT * FROM licenses WHERE is_active = true;

-- Uso por licença
SELECT * FROM usage_by_license ORDER BY last_activity DESC;

-- Logs recentes
SELECT * FROM usage_logs ORDER BY timestamp DESC LIMIT 50;

-- Estatísticas gerais
SELECT * FROM license_stats;
```

### Resetar Contadores Diários

```sql
SELECT reset_daily_counters();
```

## 🔧 Manutenção

### Atualizar a Extensão

1. Faça as alterações nos arquivos da pasta `extension/`
2. Vá em `chrome://extensions/`
3. Clique no botão de **Recarregar** na extensão

### Atualizar as APIs

1. Faça as alterações nos arquivos da pasta `api/`
2. Execute:
```bash
vercel --prod
```

### Backup do Banco

No Supabase, vá em **Database → Backups** e configure backups automáticos.

## ⚠️ Considerações Importantes

### Legais
- Esta extensão pode violar os termos de uso do Lovable.dev
- Use por sua conta e risco
- Não recomendado para uso comercial sem autorização

### Técnicas
- A extensão depende de uma conta Lovable com créditos
- Os créditos são consumidos da conta usada no proxy
- Limite de 100k requisições/mês no plano gratuito do Vercel

### Segurança
- Nunca compartilhe sua Service Role Key do Supabase
- Mantenha o JWT_SECRET seguro
- Use HTTPS em produção

## 🐛 Solução de Problemas

### Erro: "Token de sessão não encontrado"
- Faça login no Lovable.dev
- Abra um projeto
- Tente novamente

### Erro: "Licença não encontrada"
- Verifique se a chave está correta
- Confirme que a licença existe no banco
- Verifique se está ativa

### Erro: "Erro interno do servidor"
- Verifique os logs no Vercel Dashboard
- Confirme que as variáveis de ambiente estão corretas
- Teste as APIs diretamente (Postman/Insomnia)

## 📝 TODO

- [ ] Adicionar upload de arquivos
- [ ] Implementar sistema de pagamento
- [ ] Criar painel administrativo
- [ ] Adicionar mais estatísticas
- [ ] Melhorar tratamento de erros
- [ ] Adicionar testes automatizados

## 📄 Licença

MIT License - Sinta-se livre para modificar e usar como quiser.

## 🤝 Contribuições

Contribuições são bem-vindas! Abra uma issue ou pull request.

## 📧 Suporte

Para dúvidas ou problemas, abra uma issue no repositório.

---

**Desenvolvido com ❤️**
