import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const INSTAGRAM_APP_ID = Deno.env.get('META_APP_ID') || '1353481286527361';
const INSTAGRAM_APP_SECRET = Deno.env.get('META_APP_SECRET') || '';
const DEFAULT_REDIRECT_URI = 'https://wazecrm.lovable.app/oauth/callback';

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, companyId, redirectUri } = await req.json();

    if (!code || !companyId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing code or companyId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use the redirect_uri sent from frontend to ensure exact match
    const REDIRECT_URI = redirectUri || DEFAULT_REDIRECT_URI;

    console.log('Processing Instagram OAuth callback for company:', companyId);
    console.log('Using redirect_uri:', REDIRECT_URI);
    console.log('App ID:', INSTAGRAM_APP_ID);
    console.log('App Secret length:', INSTAGRAM_APP_SECRET.length);

    // Exchange code for short-lived access token
    const tokenUrl = 'https://api.instagram.com/oauth/access_token';
    const tokenParams = new URLSearchParams({
      client_id: INSTAGRAM_APP_ID,
      client_secret: INSTAGRAM_APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      code: code
    });

    console.log('Exchanging code for token...');
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString()
    });

    const tokenData = await tokenResponse.json();
    console.log('Token response status:', tokenResponse.status);

    if (!tokenResponse.ok || tokenData.error) {
      console.error('Token exchange failed:', tokenData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: tokenData.error_message || tokenData.error?.message || 'Failed to exchange code for token' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { access_token: shortLivedToken, user_id: instagramUserId } = tokenData;
    console.log('Got short-lived token for user:', instagramUserId);

    // Exchange for long-lived token
    const longLivedUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${INSTAGRAM_APP_SECRET}&access_token=${shortLivedToken}`;
    
    const longLivedResponse = await fetch(longLivedUrl);
    const longLivedData = await longLivedResponse.json();

    let accessToken = shortLivedToken;
    let expiresIn = 3600; // 1 hour for short-lived

    if (longLivedResponse.ok && longLivedData.access_token) {
      accessToken = longLivedData.access_token;
      expiresIn = longLivedData.expires_in || 5184000; // 60 days
      console.log('Got long-lived token, expires in:', expiresIn);
    }

    // Get user profile info
    const profileUrl = `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`;
    const profileResponse = await fetch(profileUrl);
    const profileData = await profileResponse.json();

    const username = profileData.username || '';
    console.log('Instagram username:', username);

    // Calculate token expiration
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update tenant_integrations
    const { data: existingIntegration } = await supabase
      .from('tenant_integrations')
      .select('id')
      .eq('company_id', companyId)
      .maybeSingle();

    const integrationData = {
      instagram_ig_id: instagramUserId,
      instagram_username: username,
      instagram_status: 'connected',
      meta_access_token: accessToken,
      meta_token_expires_at: tokenExpiresAt,
      updated_at: new Date().toISOString()
    };

    if (existingIntegration) {
      await supabase
        .from('tenant_integrations')
        .update(integrationData)
        .eq('id', existingIntegration.id);
    } else {
      await supabase
        .from('tenant_integrations')
        .insert({ company_id: companyId, ...integrationData });
    }

    // Also update whatsapp_connections for webhook processing
    const { data: existingConn } = await supabase
      .from('whatsapp_connections')
      .select('id')
      .eq('company_id', companyId)
      .maybeSingle();

    const connectionData = {
      instagram_account_id: instagramUserId,
      instagram_access_token: accessToken,
    };

    if (existingConn) {
      await supabase
        .from('whatsapp_connections')
        .update(connectionData)
        .eq('id', existingConn.id);
    } else {
      await supabase
        .from('whatsapp_connections')
        .insert({
          company_id: companyId,
          instance_name: `INSTAGRAM_${companyId.slice(0, 8).toUpperCase()}`,
          api_provider: 'meta',
          status: 'connected',
          ...connectionData
        });
    }

    console.log('Instagram integration saved successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        username,
        userId: instagramUserId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Instagram OAuth callback error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
