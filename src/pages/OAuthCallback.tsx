import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processando autenticação...');

  useEffect(() => {
    const processOAuthCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        setStatus('error');
        setMessage(errorDescription || 'Autenticação cancelada pelo usuário');
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('Código de autorização não encontrado');
        return;
      }

      try {
        // Try to get companyId from localStorage first (saved before redirect)
        let companyId = localStorage.getItem('instagram_oauth_company_id');
        
        if (!companyId) {
          // Fallback: try to get from authenticated user
          console.log('No companyId in localStorage, trying auth session...');
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session?.user) {
            // Wait a bit for session restoration
            await new Promise(resolve => setTimeout(resolve, 2000));
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
              setStatus('error');
              setMessage('Usuário não autenticado. Faça login e tente novamente.');
              return;
            }
            
            const { data: userRole } = await supabase
              .from('user_roles')
              .select('company_id')
              .eq('user_id', user.id)
              .limit(1)
              .single();
            companyId = userRole?.company_id || null;
          } else {
            const { data: userRole } = await supabase
              .from('user_roles')
              .select('company_id')
              .eq('user_id', session.user.id)
              .limit(1)
              .single();
            companyId = userRole?.company_id || null;
          }
        }

        if (!companyId) {
          setStatus('error');
          setMessage('Empresa do usuário não encontrada. Faça login e tente novamente.');
          return;
        }

        // Clean up localStorage
        localStorage.removeItem('instagram_oauth_company_id');

        console.log('Calling instagram-oauth-callback with companyId:', companyId);

        // Call edge function to exchange code for token
        const { data, error: fnError } = await supabase.functions.invoke('instagram-oauth-callback', {
          body: {
            code,
            companyId,
            redirectUri: window.location.origin + '/oauth/callback'
          }
        });

        if (fnError) {
          console.error('Edge function error:', fnError);
          let errorMsg = 'Erro na função de autenticação';
          if (typeof fnError.message === 'string') {
            errorMsg = fnError.message;
          }
          // Try to extract error from response body
          try {
            const body = JSON.parse((fnError as any)?.context?.body || '{}');
            if (body.error) errorMsg = body.error;
          } catch {}
          throw new Error(errorMsg);
        }

        if (data?.success) {
          setStatus('success');
          setMessage(`Instagram conectado com sucesso! ${data.username ? '@' + data.username : ''}`);
          toast({
            title: 'Sucesso!',
            description: 'Instagram conectado ao CRM com sucesso.'
          });
          
          setTimeout(() => {
            navigate('/configuracoes', { replace: true });
          }, 2000);
        } else {
          throw new Error(data?.error || 'Erro ao processar autenticação');
        }
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        setStatus('error');
        setMessage(err.message || 'Erro ao processar autenticação');
      }
    };

    processOAuthCallback();
  }, [searchParams, navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-6">
        {status === 'processing' && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
            <h1 className="text-2xl font-bold">Conectando Instagram...</h1>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold text-green-600">Conectado!</h1>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground">Redirecionando para configurações...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-16 w-16 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold text-destructive">Erro na Conexão</h1>
            <p className="text-muted-foreground">{message}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate('/configuracoes')}>
                Voltar às Configurações
              </Button>
              <Button onClick={() => window.location.reload()}>
                Tentar Novamente
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
