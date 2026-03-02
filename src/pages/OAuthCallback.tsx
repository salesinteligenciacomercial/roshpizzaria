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
      const errorReason = searchParams.get('error_reason');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        setStatus('error');
        setMessage(errorDescription || errorReason || 'Autenticação cancelada pelo usuário');
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('Código de autorização não encontrado');
        return;
      }

      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setStatus('error');
          setMessage('Usuário não autenticado. Faça login e tente novamente.');
          return;
        }

        // Get user's company_id from user_roles table
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('company_id')
          .eq('user_id', user.id)
          .limit(1)
          .single();

        if (!userRole) {
          setStatus('error');
          setMessage('Empresa do usuário não encontrada.');
          return;
        }

        // Call edge function to exchange code for token
        const { data, error: fnError } = await supabase.functions.invoke('instagram-oauth-callback', {
          body: {
            code,
            companyId: userRole.company_id,
            redirectUri: window.location.origin + '/oauth/callback'
          }
        });

        if (fnError) throw fnError;

        if (data?.success) {
          setStatus('success');
          setMessage('Instagram conectado com sucesso!');
          toast({
            title: 'Sucesso!',
            description: 'Instagram conectado ao CRM com sucesso.'
          });
          
          // Redirect to settings after 2 seconds
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
