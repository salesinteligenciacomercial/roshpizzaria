
CREATE OR REPLACE FUNCTION public.create_attendance_protocol(p_company_id uuid, p_telefone_formatado text, p_channel text DEFAULT 'whatsapp'::text, p_started_by text DEFAULT 'humano'::text, p_attending_user_id uuid DEFAULT NULL::uuid, p_attending_user_name text DEFAULT NULL::text, p_lead_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, protocol_number text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_protocol TEXT;
  v_id UUID;
BEGIN
  -- Always generate a new protocol number
  v_protocol := generate_protocol_number(p_company_id);

  INSERT INTO public.attendance_protocols (
    protocol_number, company_id, telefone_formatado, lead_id,
    channel, started_by, attending_user_id, attending_user_name, status
  ) VALUES (
    v_protocol, p_company_id, p_telefone_formatado, p_lead_id,
    p_channel, p_started_by, p_attending_user_id, p_attending_user_name, 'aberto'
  )
  RETURNING attendance_protocols.id INTO v_id;

  RETURN QUERY SELECT v_id, v_protocol;
END;
$function$;
