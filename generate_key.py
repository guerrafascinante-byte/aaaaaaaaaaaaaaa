import secrets
import string

def generate_license_key(segments=4, segment_length=4):
    """Gera uma chave de licença no formato XXXX-XXXX-XXXX-XXXX."""
    chars = string.ascii_uppercase + string.digits
    key = []
    for _ in range(segments):
        segment = ''.join(secrets.choice(chars) for _ in range(segment_length))
        key.append(segment)
    return '-'.join(key)

def generate_insert_sql(key, user_id="custom_user", plan="Pro Custom", is_active=True, expires_at=None):
    """Gera o comando SQL para inserir a chave no Supabase."""
    
    # Formata a data de expiração para SQL
    expires_sql = f"'{expires_at}'" if expires_at else 'NULL'
    
    # O Lovable original usa o formato YYYY-MM-DDTHH:MM:SS.000Z
    if expires_at is None:
        # Exemplo: 1 ano de validade
        from datetime import datetime, timedelta
        expires_at = (datetime.utcnow() + timedelta(days=365)).isoformat() + 'Z'
        expires_sql = f"'{expires_at}'"

    sql = f"""
INSERT INTO licenses (key, user_id, plan, is_active, expires_at, created_at, requests_today, max_requests_day)
VALUES (
    '{key}',
    '{user_id}',
    '{plan}',
    {is_active},
    {expires_sql},
    NOW(),
    0,
    9999
);
"""
    return sql.strip()

# --- Geração e Saída ---
new_key = generate_license_key()
sql_command = generate_insert_sql(new_key)

print(f"--- Chave de Licença Gerada ---")
print(f"Chave: {new_key}")
print(f"-------------------------------")
print(f"Comando SQL para Supabase:")
print(sql_command)
print(f"-------------------------------")
