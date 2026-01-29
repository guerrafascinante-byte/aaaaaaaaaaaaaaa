import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// Configuração do Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuração JWT
const JWT_SECRET = process.env.JWT_SECRET;

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
    const { action, project_id, messages } = req.body;
    
    if (!action || !project_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dados incompletos (action e project_id são obrigatórios)' 
      });
    }
    
    // Ações disponíveis: save, load, clear
    switch (action) {
      case 'save':
        return await saveHistory(license_key, project_id, messages, res);
      
      case 'load':
        return await loadHistory(license_key, project_id, res);
      
      case 'clear':
        return await clearHistory(license_key, project_id, res);
      
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Ação inválida. Use: save, load ou clear' 
        });
    }
    
  } catch (error) {
    console.error('Erro na sincronização:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}

// Salvar histórico
async function saveHistory(license_key, project_id, messages, res) {
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Mensagens inválidas' 
    });
  }
  
  try {
    // Verificar se já existe histórico
    const { data: existing } = await supabase
      .from('chat_history')
      .select('id')
      .eq('license_key', license_key)
      .eq('project_id', project_id)
      .single();
    
    if (existing) {
      // Atualizar existente
      const { error } = await supabase
        .from('chat_history')
        .update({ 
          messages: messages,
          updated_at: new Date().toISOString()
        })
        .eq('license_key', license_key)
        .eq('project_id', project_id);
      
      if (error) throw error;
    } else {
      // Criar novo
      const { error } = await supabase
        .from('chat_history')
        .insert({
          license_key: license_key,
          project_id: project_id,
          messages: messages
        });
      
      if (error) throw error;
    }
    
    return res.status(200).json({
      success: true,
      data: {
        saved: messages.length,
        message: 'Histórico salvo com sucesso'
      }
    });
    
  } catch (error) {
    console.error('Erro ao salvar histórico:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erro ao salvar histórico' 
    });
  }
}

// Carregar histórico
async function loadHistory(license_key, project_id, res) {
  try {
    const { data, error } = await supabase
      .from('chat_history')
      .select('messages, updated_at')
      .eq('license_key', license_key)
      .eq('project_id', project_id)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw error;
    }
    
    if (!data) {
      return res.status(200).json({
        success: true,
        data: {
          messages: [],
          count: 0,
          message: 'Nenhum histórico encontrado'
        }
      });
    }
    
    return res.status(200).json({
      success: true,
      data: {
        messages: data.messages || [],
        count: data.messages?.length || 0,
        updated_at: data.updated_at,
        message: 'Histórico carregado com sucesso'
      }
    });
    
  } catch (error) {
    console.error('Erro ao carregar histórico:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erro ao carregar histórico' 
    });
  }
}

// Limpar histórico
async function clearHistory(license_key, project_id, res) {
  try {
    const { error } = await supabase
      .from('chat_history')
      .delete()
      .eq('license_key', license_key)
      .eq('project_id', project_id);
    
    if (error) throw error;
    
    return res.status(200).json({
      success: true,
      data: {
        message: 'Histórico limpo com sucesso'
      }
    });
    
  } catch (error) {
    console.error('Erro ao limpar histórico:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erro ao limpar histórico' 
    });
  }
}
