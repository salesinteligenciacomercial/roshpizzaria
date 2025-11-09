import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EdgeFunctionOptions {
  maxRetries?: number;
  timeout?: number;
  fallback?: () => any | Promise<any>;
  onError?: (error: any, attempt: number) => void;
}

/**
 * Hook para chamar Edge Functions com retry, timeout e fallback
 * Melhora confiabilidade e experiência do usuário
 */
export const useEdgeFunctionCaller = () => {
  const callEdgeFunctionWithRetry = useCallback(async <T = any>(
    functionName: string,
    body: any,
    options: EdgeFunctionOptions = {}
  ): Promise<T | null> => {
    const {
      maxRetries = 3,
      timeout = 10000,
      fallback,
      onError
    } = options;

    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [EDGE-FUNCTION] Chamando ${functionName} (tentativa ${attempt}/${maxRetries})...`);

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Timeout após ${timeout}ms`));
          }, timeout);
        });

        const functionPromise = supabase.functions.invoke(functionName, { body });

        const result = await Promise.race([functionPromise, timeoutPromise]);

        if (!result || !result.data) {
          throw new Error('Resposta inválida da edge function');
        }

        if (result.error) {
          throw new Error(result.error.message || 'Erro na edge function');
        }

        console.log(`✅ [EDGE-FUNCTION] ${functionName} executada com sucesso (tentativa ${attempt})`);
        return result.data as T;

      } catch (error: any) {
        lastError = error;
        const errorMessage = error?.message || String(error);
        
        console.error(`❌ [EDGE-FUNCTION] Erro ao chamar ${functionName} (tentativa ${attempt}/${maxRetries}):`, {
          error: errorMessage,
          attempt,
          functionName,
          body: typeof body === 'object' ? JSON.stringify(body).substring(0, 100) : body
        });

        if (onError) {
          onError(error, attempt);
        }

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`⏳ [EDGE-FUNCTION] Aguardando ${delay}ms antes de tentar novamente...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`❌ [EDGE-FUNCTION] Todas as tentativas falharam para ${functionName}. Último erro:`, lastError);
    
    if (fallback) {
      console.log(`🔄 [EDGE-FUNCTION] Usando fallback para ${functionName}`);
      try {
        return await fallback();
      } catch (fallbackError) {
        console.error(`❌ [EDGE-FUNCTION] Erro no fallback para ${functionName}:`, fallbackError);
      }
    }

    return null;
  }, []);

  return { callEdgeFunctionWithRetry };
};
