-- Criar company para o Douglas
DO $$
DECLARE
  v_company_id uuid;
BEGIN
  -- Verificar se já existe company para o Douglas
  SELECT id INTO v_company_id
  FROM public.companies
  WHERE owner_user_id = 'b3718e09-8258-4264-aea3-06a57523d420';
  
  -- Se não existe, criar
  IF v_company_id IS NULL THEN
    INSERT INTO public.companies (
      name,
      cnpj,
      status,
      plan,
      max_users,
      max_leads,
      max_whatsapp_messages,
      owner_user_id,
      settings
    ) VALUES (
      'Douglas - Subconta',
      '00.000.000/0001-00',
      'active',
      'basic',
      10,
      500,
      2000,
      'b3718e09-8258-4264-aea3-06a57523d420',
      '{"email": "douglas@gmail.com", "responsavel": "Douglas", "telefone": ""}'::jsonb
    ) RETURNING id INTO v_company_id;
    
    -- Adicionar Douglas à tabela user_roles como company_admin
    INSERT INTO public.user_roles (user_id, company_id, role)
    VALUES ('b3718e09-8258-4264-aea3-06a57523d420', v_company_id, 'company_admin');
    
    -- Criar conexão WhatsApp para o Douglas com a instância DO2
    INSERT INTO public.whatsapp_connections (
      company_id,
      instance_name,
      evolution_api_url,
      evolution_api_key,
      status
    ) VALUES (
      v_company_id,
      'DO2',
      'https://evolution-evolution-api.kxuvcf.easypanel.host',
      '51FB2B2DD218-4A38-9D95-B39354293701',
      'connected'
    );
  END IF;
END $$;