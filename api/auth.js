import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// Configuração do Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuração JWT
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '24h';

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
    const { license_key } = req.body;
    
    if (!license_key) {
      return res.status(400).json({ 
        success: false, 
        error: 'Chave de licença não fornecida' 
      });
    }
    
    // Validar formato da chave
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(license_key)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Formato de chave inválido' 
      });
    }
    
    // Buscar licença no banco
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
        // Desativar licença expirada
        await supabase
          .from('licenses')
          .update({ is_active: false })
          .eq('license_key', license_key);
        
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
    
    // Gerar JWT token
    const token = jwt.sign(
      { 
        license_key: license.license_key,
        plan_type: license.plan_type,
        id: license.id
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    // Atualizar última verificação
    await supabase
      .from('licenses')
      .update({ updated_at: new Date().toISOString() })
      .eq('license_key', license_key);
    
    // Registrar log de autenticação
    await supabase
      .from('usage_logs')
      .insert({
        license_key: license_key,
        action: 'auth',
        metadata: { 
          ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
          user_agent: req.headers['user-agent']
        }
      });
    
    // Retornar sucesso
    return res.status(200).json({
      success: true,
      data: {
        token,
        license: {
          name: license.name,
          plan_type: license.plan_type,
          is_active: license.is_active,
          expires_at: license.expires_at,
          requests_today: license.requests_today,
          requests_total: license.requests_total,
          max_requests_day: license.max_requests_day
        }
      }
    });
    
  } catch (error) {
    console.error('Erro na autenticação:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
}
