# Lovable Custom Proxy (Seu Próprio Servidor de Chaves)

Este projeto contém o código-fonte para o seu próprio servidor proxy e sistema de licenciamento, replicando a funcionalidade da extensão "Estagiário v2" para que você tenha controle total sobre suas chaves de acesso.

## 1. Configuração do Banco de Dados (Supabase)

Você precisará de uma conta no Supabase para gerenciar suas chaves.

### 1.1. Criar a Tabela `licenses`

No seu painel do Supabase, execute o seguinte comando SQL para criar a tabela de licenças:

\`\`\`sql
CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'Pro Custom',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    requests_today INTEGER DEFAULT 0,
    max_requests_day INTEGER DEFAULT 9999
);
\`\`\`

### 1.2. Obter Credenciais

Você precisará de duas credenciais para o arquivo `server.js`:
1.  **SUPABASE_URL**: Encontrada em `Settings -> API`.
2.  **SUPABASE_ANON_KEY**: Encontrada em `Settings -> API` (a chave `anon public`).

## 2. Configuração do Servidor Proxy (server.js)

Edite o arquivo `server.js` e substitua os placeholders com suas credenciais:

\`\`\`javascript
// --- CONFIGURAÇÃO ---
const SUPABASE_URL = 'SUA_URL_SUPABASE'; // <-- Substitua
const SUPABASE_ANON_KEY = 'SUA_CHAVE_ANON_SUPABASE'; // <-- Substitua
const FIREBASE_API_KEY = 'SUA_CHAVE_API_FIREBASE'; // <-- Substitua (veja nota abaixo)
// ...
\`\`\`

**NOTA sobre `FIREBASE_API_KEY`**: Esta chave é necessária para autenticar a chamada ao Firestore do Lovable. Você pode encontrá-la no código-fonte da extensão original ou inspecionando as chamadas de rede no Lovable.dev.

## 3. Geração de Chaves de Licença

Use o script `generate_key.py` para criar novas chaves e o comando SQL para inseri-las no seu banco de dados:

\`\`\`bash
python3 generate_key.py
\`\`\`

O script irá imprimir uma chave e o comando `INSERT` correspondente. Copie e cole o comando `INSERT` no editor SQL do Supabase para ativar a chave.

## 4. Execução do Servidor

1.  Instale as dependências (se ainda não o fez):
    \`\`\`bash
    npm install
    \`\`\`
2.  Execute o servidor:
    \`\`\`bash
    node server.js
    \`\`\`

## 5. Atualização da Extensão (Seu Próximo Passo)

Após o deploy do seu servidor (ex: para `https://meu-proxy-lovable.com`), você precisará atualizar a extensão Lovable Custom (v1.2) para apontar para o seu novo proxy.

No arquivo `popup.js` da extensão, substitua:

\`\`\`javascript
// Endpoints originais do proxy
const AUTH_URL = 'https://wviwbsoaacjzzyfwrxfj.supabase.co/functions/v1/radioai-authorization';
const PROXY_URL = 'https://wviwbsoaacjzzyfwrxfj.supabase.co/functions/v1/radioai-proxy';
\`\`\`

Por:

\`\`\`javascript
// Seus novos endpoints
const AUTH_URL = 'https://SEU_DOMINIO_DO_PROXY/v1/radioai-authorization';
const PROXY_URL = 'https://SEU_DOMINIO_DO_PROXY/v1/radioai-proxy';
\`\`\`

Com isso, sua extensão estará usando seu próprio sistema de chaves e proxy.
\`\`\`
