const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// --- CONFIGURAÇÃO ---
// Substitua pelos seus dados do Supabase
const SUPABASE_URL = 'https://supabase.com/dashboard/project/aypdymvyiunbsyxfwisc';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5cGR5bXZ5aXVuYnN5eGZ3aXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NTEyNjUsImV4cCI6MjA4NTEyNzI2NX0.qSRwGEORbSwZDehtDq1uTpUloclg3Dk4O4O8SD8VhyA';
const FIREBASE_API_KEY = 'AIzaSyD5z6B7C8D9E0F1G2H3I4J5K6L7M8N9O0'; // Chave de API do Lovable (pode ser obtida no código da extensão original)

// O ID do projeto do GPT-Engineer/Lovable no Firestore (constante)
const GPT_ENGINEER_PROJECT_ID = 'gpt-engineer-390607';

// O endpoint real do Firestore para onde as mensagens serão enviadas
const FIRESTORE_ENDPOINT = `https://firestore.googleapis.com/v1/projects/${GPT_ENGINEER_PROJECT_ID}/databases/(default)/documents/projects`;

// O nome da tabela onde suas chaves de licença estarão
const LICENSE_TABLE = 'licenses';

// --- INICIALIZAÇÃO ---
const app = express();
const port = 3000;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

app.use(express.json());

// --- MIDDLEWARE DE AUTENTICAÇÃO DE CHAVE ---
async function authenticateLicense(req, res, next) {
    const licenseKey = req.headers['x-license-key'];

    if (!licenseKey) {
        return res.status(401).json({ success: false, error: { code: 'AUTH_006', message: 'License key missing' } });
    }

    try {
        const { data, error } = await supabase
            .from(LICENSE_TABLE)
            .select('*')
            .eq('license_key', licenseKey) // Corrigido: nome da coluna
            .single();

        if (error || !data) {
            return res.status(403).json({ success: false, error: { code: 'AUTH_001', message: 'Invalid or expired license' } });
        }

        if (data.is_active === false || (data.expires_at && new Date(data.expires_at) < new Date())) {
            return res.status(403).json({ success: false, error: { code: 'AUTH_002', message: 'License expired or inactive' } });
        }

        // Anexa os dados da licença ao request para uso posterior (ex: contagem de uso)
        req.licenseData = data;
        next();

    } catch (e) {
        console.error('Database error:', e);
        return res.status(500).json({ success: false, error: { code: 'DB_001', message: 'Internal server error' } });
    }
}

// --- ROTA DE STATUS (PARA TESTE) ---
app.get('/', (req, res) => {
    res.send('Lovable Proxy is Running! 🚀');
});

// --- ROTA PRINCIPAL DO PROXY (Emula o radioai-proxy) ---
app.post('/v1/radioai-proxy', authenticateLicense, async (req, res) => {
    const { projectId, message, fileMeta, messages, chatOnlyMode } = req.body;
    const { user_id } = req.licenseData; // Usar o user_id da licença para rastreamento

    if (!projectId || !message) {
        return res.status(400).json({ success: false, error: { code: 'API_005', message: 'Missing required parameters' } });
    }

    // 1. Preparar o payload para o Firestore (GPT-Engineer)
    // O Lovable usa o Firestore para registrar a "trajetória" (trajectory) da conversa
    const trajectoryPayload = {
        fields: {
            // Estrutura de dados que o Lovable espera para uma nova mensagem
            user_id: { stringValue: user_id },
            message: { stringValue: message },
            timestamp: { timestampValue: new Date().toISOString() },
            // Outros campos necessários para o GPT-Engineer
            // ...
        }
    };

    // 2. Enviar a mensagem para o Firestore
    // O endpoint é: /projects/{projectId}/trajectory
    const firestoreUrl = `${FIRESTORE_ENDPOINT}/${projectId}/trajectory?key=${FIREBASE_API_KEY}`;

    try {
        const firestoreResponse = await fetch(firestoreUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(trajectoryPayload)
        });

        const firestoreData = await firestoreResponse.json();

        if (!firestoreResponse.ok) {
            console.error('Firestore Error:', firestoreData);
            return res.status(500).json({ success: false, error: { code: 'API_004', message: 'Error sending message to Lovable backend', details: firestoreData } });
        }

        // 3. Simular a resposta de sucesso do proxy original
        // O proxy original devolve um JSON simples de sucesso
        res.json({
            success: true,
            data: {
                message: 'Mensagem enviada com sucesso para o backend do Lovable (via seu proxy!)',
                // Aqui você pode adicionar a lógica de contagem de tokens/créditos
            }
        });

    } catch (e) {
        console.error('Proxy fetch error:', e);
        return res.status(500).json({ success: false, error: { code: 'NET_001', message: 'Network error communicating with Lovable backend' } });
    }
});

// --- ROTA DE VERIFICAÇÃO DE LICENÇA (Emula o radioai-authorization) ---
app.post('/v1/radioai-authorization', async (req, res) => {
    const { licenseKey } = req.body;

    if (!licenseKey) {
        return res.status(400).json({ success: false, error: { code: 'AUTH_006', message: 'License key missing' } });
    }

    try {
        const { data, error } = await supabase
            .from(LICENSE_TABLE)
            .select('*')
            .eq('license_key', licenseKey) // Corrigido: nome da coluna
            .single();

        if (error || !data) {
            return res.status(403).json({ success: false, error: { code: 'AUTH_001', message: 'Invalid license' } });
        }

        // Simular o retorno de um token JWT (não é necessário, mas emula o original)
        const mockToken = `MOCK_JWT_FOR_${data.license_key}`;

        res.json({
            success: true,
            data: {
                token: mockToken,
                license: {
                    key: data.license_key, // Corrigido: mapear da coluna certa
                    is_active: data.is_active !== false, // Garantir boolean
                    expires_at: data.expires_at,
                    plan: data.plan,
                    requests_today: data.requests_today || 0,
                    max_requests_day: data.max_requests_day || 100,
                    is_trial: data.plan === 'Trial'
                }
            }
        });

    } catch (e) {
        console.error('Authorization database error:', e);
        return res.status(500).json({ success: false, error: { code: 'DB_001', message: 'Internal server error' } });
    }
});

// --- INICIAR SERVIDOR ---
// --- INICIAR SERVIDOR ---
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Proxy server listening at http://localhost:${port}`);
    });
}

module.exports = app;
