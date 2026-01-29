import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch'; // Importação explícita para compatibilidade

// Configuração do Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuração JWT
const JWT_SECRET = process.env.JWT_SECRET;

// URL da API Lovable
const LOVABLE_API_URL = 'https://api.lovable.dev';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Método não permitido' 
    });
  }
  
  try {
    // Verificar token JWT
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token de autenticação não fornecido' 
      });
    }
    
    const token = authHeader.substring(7);
    let decoded;
    
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token inválido ou expirado' 
      });
    }
    
    const { license_key } = decoded;
    
    // Buscar licença atualizada
    const { data: license, error: dbError } = await supabase
      .from('licenses')
      .select('*')
      .eq('license_key', license_key)
      .single();
    
    if (dbError || !license) {
      return res.status(404).json({ 
        success: false, 
        error: 'Licença não encontrada' 
      });
    }
    
    // Verificar se está ativa
    if (!license.is_active) {
      return res.status(403).json({ 
        success: false, 
        error: 'Licença inativa' 
      });
    }
    
    // Verificar expiração
    if (license.expires_at) {
      const expiresDate = new Date(license.expires_at);
      const now = new Date();
      
      if (expiresDate < now) {
        return res.status(403).json({ 
          success: false, 
          error: 'Licença expirada' 
        });
      }
    }
    
    // Verificar limite de requisições (para trial)
    if (license.plan_type === 'trial') {
      if (license.requests_today >= license.max_requests_day) {
        return res.status(403).json({ 
          success: false, 
          error: `Limite de ${license.max_requests_day} requisições diárias atingido` 
        });
      }
    }
    
    // Extrair dados da requisição
    const { project_id, session_token, message, files, chat_only } = req.body;
    
    if (!project_id || !session_token || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dados incompletos (project_id, session_token, message são obrigatórios)' 
      });
    }
    
    // Montar payload para API Lovable
    const lovablePayload = {
      id: '',
      message: message,
      files: files || [],
      selected_elements: [],
      chat_only: chat_only || false,
      debug_mode: false,
      view: 'preview',
      view_description: 'The user is currently viewing the preview.',
      optimisticImageUrls: [],
      ai_message_id: `aimsg_${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
      current_page: '/',
      model: null,
      session_replay: null,
      client_logs: [],
      network_requests: [],
      runtime_errors: []
    };
    
    // Fazer requisição para API Lovable
    const lovableResponse = await fetch(`${LOVABLE_API_URL}/projects/${project_id}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session_token}`,
        'User-Agent': 'Lovable-Pro-Extension/1.0'
      },
      body: JSON.stringify(lovablePayload)
    });
    
    // Processar resposta
    let lovableData;
    const contentType = lovableResponse.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      lovableData = await lovableResponse.json();
    } else {
      lovableData = { text: await lovableResponse.text() };
    }
    
    // Verificar se houve erro
    if (!lovableResponse.ok) {
      // Registrar erro
      await supabase
        .from('usage_logs')
        .insert({
          license_key: license_key,
          project_id: project_id,
          action: 'proxy_error',
          metadata: { 
            status: lovableResponse.status,
            error: lovableData,
            message: message.substring(0, 100)
          }
        });
      
      return res.status(lovableResponse.status).json({
        success: false,
        error: lovableData.error || lovableData.text || 'Erro na API Lovable',
        details: lovableData
      });
    }
    
    // Incrementar contador de requisições
    const today = new Date().toISOString().split('T')[0];
    const lastUpdate = license.updated_at ? new Date(license.updated_at).toISOString().split('T')[0] : null;
    
    // Resetar contador se for um novo dia
    const newRequestsToday = (lastUpdate === today) 
      ? license.requests_today + 1 
      : 1;
    
    await supabase
      .from('licenses')
      .update({ 
        requests_today: newRequestsToday,
        requests_total: license.requests_total + 1,
        updated_at: new Date().toISOString()
      })
      .eq('license_key', license_key);
    
    // Registrar log de uso
    await supabase
      .from('usage_logs')
      .insert({
        license_key: license_key,
        project_id: project_id,
        action: 'proxy_success',
        metadata: { 
          message: message.substring(0, 100),
          chat_only: chat_only,
          files_count: files?.length || 0
        }
      });
    
    // Retornar sucesso
    return res.status(200).json({
      success: true,
      data: {
        response: lovableData.message || lovableData.text || 'Mensagem enviada com sucesso',
        raw: lovableData,
        usage: {
          requests_today: newRequestsToday,
          requests_total: license.requests_total + 1
        }
      }
    });
    
  } catch (error) {
    console.error('Erro no proxy:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}
