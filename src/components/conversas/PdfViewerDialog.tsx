import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Download, X, Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  fileName?: string;
}

// Função para extrair URL original de blob ou obter URL base
const getOriginalUrl = (url: string): string | null => {
  if (!url) return null;
  
  // Se é blob ou data URL, não podemos usar diretamente para re-fetch
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    console.log('⚠️ [PDF-VIEWER] URL é blob/data, não é possível re-fetch');
    return null;
  }
  
  return url;
};

export function PdfViewerDialog({ open, onOpenChange, url, fileName }: PdfViewerDialogProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pdfFile, setPdfFile] = useState<{ data: ArrayBuffer } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastUrlRef = useRef<string>('');

  useEffect(() => {
    if (open && url) {
      // Sempre recarregar quando abrir para garantir que temos dados frescos
      setLoading(true);
      setError(false);
      setCurrentPage(1);
      loadPdf();
    }

    return () => {
      // Cancelar fetch pendente
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [open, url]);

  // Cleanup quando fechar
  useEffect(() => {
    if (!open) {
      setPdfFile(null);
      setNumPages(0);
      setLoading(true);
    }
  }, [open]);

  const loadPdf = async () => {
    try {
      // Cancelar qualquer fetch anterior
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      let fetchUrl = url;
      
      // Se é blob URL, tentar usar mas pode falhar
      if (url.startsWith('blob:')) {
        console.log('⚠️ [PDF-VIEWER] Tentando usar blob URL (pode falhar se expirada):', url.substring(0, 60));
      }

      console.log('📥 [PDF-VIEWER] Carregando PDF:', {
        urlType: url.startsWith('blob:') ? 'blob' : url.startsWith('data:') ? 'data' : 'http',
        urlPreview: url.substring(0, 80)
      });

      const response = await fetch(fetchUrl, {
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        throw new Error(`Falha ao carregar PDF: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      if (arrayBuffer.byteLength === 0) {
        throw new Error('PDF vazio');
      }

      console.log('✅ [PDF-VIEWER] PDF carregado com sucesso:', {
        size: arrayBuffer.byteLength,
        fileName
      });

      // Usar ArrayBuffer diretamente em vez de blob URL
      setPdfFile({ data: arrayBuffer });
      lastUrlRef.current = url;
      
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('ℹ️ [PDF-VIEWER] Fetch cancelado');
        return;
      }
      
      console.error('❌ [PDF-VIEWER] Erro ao carregar PDF:', err);
      setError(true);
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      toast.info('Iniciando download...');
      
      let downloadData: ArrayBuffer;
      
      // Se já temos os dados, usar diretamente
      if (pdfFile?.data) {
        downloadData = pdfFile.data;
      } else {
        // Fazer novo fetch
        const response = await fetch(url);
        if (!response.ok) throw new Error('Falha ao baixar');
        downloadData = await response.arrayBuffer();
      }

      const blob = new Blob([downloadData], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName || 'documento.pdf';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Limpar blob URL após download
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      
      toast.success('Download concluído!');
    } catch (err) {
      console.error('Erro ao baixar PDF:', err);
      toast.error('Erro ao baixar arquivo');
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const goToNextPage = () => {
    if (currentPage < numPages) setCurrentPage(currentPage + 1);
  };

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 3));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.5));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-600" />
              <DialogTitle className="text-sm font-medium truncate max-w-[200px]">
                {fileName || 'Documento PDF'}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="gap-1"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Baixar</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        {/* Controls */}
        {!error && numPages > 0 && (
          <div className="flex items-center justify-center gap-4 p-2 border-b bg-background/50 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={goToPrevPage}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm min-w-[80px] text-center">
                {currentPage} / {numPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={goToNextPage}
                disabled={currentPage >= numPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={zoomOut}
                disabled={scale <= 0.5}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm min-w-[50px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={zoomIn}
                disabled={scale >= 3}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
        
        <div className="flex-1 overflow-auto flex items-start justify-center p-4 bg-muted/30">
          {loading && !pdfFile && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando PDF...</p>
            </div>
          )}
          
          {error && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <FileText className="h-16 w-16 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Não foi possível carregar o PDF</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadPdf}>
                  Tentar novamente
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar arquivo
                </Button>
              </div>
            </div>
          )}
          
          {pdfFile && (
            <Document
              file={pdfFile}
              onLoadSuccess={({ numPages }) => {
                setNumPages(numPages);
                setLoading(false);
              }}
              onLoadError={(err) => {
                console.error('Erro ao carregar PDF:', err);
                setError(true);
                setLoading(false);
              }}
              loading={null}
              className={loading ? 'hidden' : ''}
            >
              <Page 
                pageNumber={currentPage} 
                scale={scale}
                className="shadow-lg rounded"
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </Document>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
