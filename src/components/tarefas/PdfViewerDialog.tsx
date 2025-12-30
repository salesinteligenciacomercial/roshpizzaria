import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface PdfViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  fileName: string;
}

export function PdfViewerDialog({ open, onOpenChange, url, fileName }: PdfViewerDialogProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [viewMode, setViewMode] = useState<'blob' | 'direct' | 'google'>('blob');

  useEffect(() => {
    if (open && url) {
      loadPdf();
    }
    
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [open, url]);

  const loadPdf = async () => {
    setLoading(true);
    setError(false);
    setBlobUrl(null);
    
    try {
      const response = await fetch(url, {
        mode: 'cors',
        credentials: 'omit'
      });
      
      if (!response.ok) {
        throw new Error('Erro ao carregar PDF');
      }
      
      const blob = await response.blob();
      // Garantir que o blob tem o tipo correto
      const pdfBlob = new Blob([blob], { type: 'application/pdf' });
      const newBlobUrl = URL.createObjectURL(pdfBlob);
      setBlobUrl(newBlobUrl);
      setViewMode('blob');
    } catch (err) {
      console.error('Erro ao carregar PDF via blob:', err);
      // Tentar modo direto como fallback
      setViewMode('direct');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      toast.loading('Baixando...', { id: 'pdf-download' });
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Erro ao baixar');
      
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      toast.success('PDF baixado!', { id: 'pdf-download' });
    } catch (err) {
      console.error('Erro ao baixar:', err);
      toast.error('Erro ao baixar PDF', { id: 'pdf-download' });
    }
  };

  const openInNewTab = () => {
    window.open(url, '_blank');
  };

  const tryGoogleViewer = () => {
    setViewMode('google');
  };

  const getIframeSrc = () => {
    switch (viewMode) {
      case 'blob':
        return blobUrl || '';
      case 'direct':
        return url;
      case 'google':
        return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
      default:
        return url;
    }
  };

  const handleIframeError = () => {
    if (viewMode === 'blob') {
      setViewMode('direct');
    } else if (viewMode === 'direct') {
      setViewMode('google');
    } else {
      setError(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b flex-row items-center justify-between">
          <DialogTitle className="text-base truncate flex-1 pr-4">{fileName}</DialogTitle>
          <div className="flex items-center gap-2">
            {viewMode !== 'google' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={tryGoogleViewer}
                className="h-8 text-xs"
                title="Tentar visualizador alternativo"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Alternativo
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={openInNewTab}
              className="h-8"
              title="Abrir em nova aba"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="h-8"
            >
              <Download className="h-4 w-4 mr-1" />
              Baixar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="relative h-[75vh] w-full bg-muted">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Carregando PDF...</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-4 text-center p-8">
                <p className="text-muted-foreground">
                  Não foi possível exibir o PDF no navegador.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={openInNewTab}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir em nova aba
                  </Button>
                  <Button onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar PDF
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {!loading && !error && (
            <>
              {/* Object tag para melhor compatibilidade com PDFs */}
              {viewMode === 'blob' && blobUrl ? (
                <object
                  data={blobUrl}
                  type="application/pdf"
                  className="w-full h-full"
                  onError={handleIframeError}
                >
                  <iframe
                    src={blobUrl}
                    className="w-full h-full border-0"
                    title={fileName}
                    onError={handleIframeError}
                  />
                </object>
              ) : (
                <iframe
                  src={getIframeSrc()}
                  className="w-full h-full border-0"
                  title={fileName}
                  onError={handleIframeError}
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                />
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
