import { useState, useEffect, memo } from "react";
import { ExternalLink, Globe, Loader2 } from "lucide-react";

interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

interface LinkPreviewProps {
  url: string;
  className?: string;
}

// Regex para detectar URLs no texto
const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;

// Cache de previews para evitar requisições duplicadas
const previewCache = new Map<string, LinkPreviewData | null>();

// Extrair URLs de um texto
export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  return matches ? [...new Set(matches)] : [];
}

// Componente de preview de link
function LinkPreviewComponent({ url, className = "" }: LinkPreviewProps) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchPreview = async () => {
      // Verificar cache
      if (previewCache.has(url)) {
        setPreview(previewCache.get(url) || null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(false);

        // Usar um serviço de metadata extração
        // Tentamos múltiplos serviços para maior confiabilidade
        const encodedUrl = encodeURIComponent(url);
        
        // Usar jsonlink.io (gratuito e confiável)
        const response = await fetch(
          `https://jsonlink.io/api/extract?url=${encodedUrl}`,
          { 
            signal: AbortSignal.timeout(5000),
            headers: {
              'Accept': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch preview');
        }

        const data = await response.json();
        
        const previewData: LinkPreviewData = {
          url: url,
          title: data.title || new URL(url).hostname,
          description: data.description,
          image: data.images?.[0] || data.image,
          siteName: data.domain || new URL(url).hostname,
          favicon: data.favicon || `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`
        };

        previewCache.set(url, previewData);
        setPreview(previewData);
      } catch (err) {
        console.log('Link preview error:', err);
        
        // Fallback: criar preview básico com informações da URL
        try {
          const urlObj = new URL(url);
          const basicPreview: LinkPreviewData = {
            url: url,
            title: urlObj.hostname.replace('www.', ''),
            siteName: urlObj.hostname,
            favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`
          };
          previewCache.set(url, basicPreview);
          setPreview(basicPreview);
        } catch {
          setError(true);
          previewCache.set(url, null);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [url]);

  if (error || (!loading && !preview)) {
    return null;
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-2 p-2 mt-1 bg-muted/30 rounded-lg border border-border/50 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Carregando preview...</span>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block mt-2 rounded-lg overflow-hidden border border-border/50 hover:border-primary/30 transition-colors bg-background/50 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Imagem do preview */}
      {preview.image && (
        <div className="w-full h-32 bg-muted overflow-hidden">
          <img
            src={preview.image}
            alt={preview.title || 'Link preview'}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Esconder se imagem falhar
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.style.display = 'none';
            }}
          />
        </div>
      )}
      
      {/* Conteúdo do preview */}
      <div className="p-2.5 space-y-1">
        {/* Site name e favicon */}
        <div className="flex items-center gap-1.5">
          {preview.favicon ? (
            <img 
              src={preview.favicon} 
              alt="" 
              className="w-4 h-4 rounded-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <Globe className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide truncate">
            {preview.siteName || new URL(preview.url).hostname}
          </span>
          <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
        </div>
        
        {/* Título */}
        {preview.title && (
          <h4 className="text-sm font-medium text-foreground line-clamp-2 leading-tight">
            {preview.title}
          </h4>
        )}
        
        {/* Descrição */}
        {preview.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {preview.description}
          </p>
        )}
      </div>
    </a>
  );
}

export const LinkPreview = memo(LinkPreviewComponent);

// Componente para renderizar texto com links clicáveis
interface TextWithLinksProps {
  text: string;
  className?: string;
}

function TextWithLinksComponent({ text, className = "" }: TextWithLinksProps) {
  const urls = extractUrls(text);
  
  // Renderizar texto com links clicáveis
  const renderTextWithLinks = () => {
    if (urls.length === 0) {
      return <span>{text}</span>;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    
    // Encontrar todas as URLs e suas posições
    const matches = [...text.matchAll(URL_REGEX)];
    
    matches.forEach((match, index) => {
      const url = match[0];
      const startIndex = match.index!;
      
      // Adicionar texto antes da URL
      if (startIndex > lastIndex) {
        parts.push(<span key={`text-${index}`}>{text.slice(lastIndex, startIndex)}</span>);
      }
      
      // Adicionar link clicável
      parts.push(
        <a
          key={`link-${index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700 hover:underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
      );
      
      lastIndex = startIndex + url.length;
    });
    
    // Adicionar texto restante
    if (lastIndex < text.length) {
      parts.push(<span key="text-end">{text.slice(lastIndex)}</span>);
    }
    
    return <>{parts}</>;
  };

  return (
    <div className={className}>
      <p className="text-sm break-words overflow-wrap-anywhere whitespace-pre-wrap">
        {renderTextWithLinks()}
      </p>
      
      {/* Mostrar preview apenas do primeiro link */}
      {urls.length > 0 && (
        <LinkPreview url={urls[0]} />
      )}
    </div>
  );
}

export const TextWithLinks = memo(TextWithLinksComponent);
