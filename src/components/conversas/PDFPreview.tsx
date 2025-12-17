import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FileText, Eye, Loader2 } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFPreviewProps {
  url: string;
  fileName?: string;
  onClick?: () => void;
}

export function PDFPreview({ url, fileName, onClick }: PDFPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pdfLoaded, setPdfLoaded] = useState(false);

  // Reset state when URL changes
  useEffect(() => {
    setLoading(true);
    setError(false);
    setPdfLoaded(false);
  }, [url]);

  // Timeout fallback - se não carregar em 5s, mostra fallback
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!pdfLoaded) {
        setError(true);
        setLoading(false);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [url, pdfLoaded]);

  // Fallback estático
  if (error) {
    return (
      <div 
        className="relative cursor-pointer hover:opacity-90 transition-opacity border border-border rounded-lg overflow-hidden bg-muted/30"
        onClick={onClick}
        style={{ width: '200px', height: '140px' }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-muted/30 to-muted/60 p-4">
          <FileText className="h-12 w-12 text-red-500 mb-2" />
          <p className="text-xs text-center text-muted-foreground font-medium line-clamp-2 px-2">
            {fileName || 'Documento PDF'}
          </p>
          <div className="flex items-center gap-1 mt-2 text-primary bg-background/80 px-3 py-1.5 rounded-full">
            <Eye className="h-3 w-3" />
            <span className="text-xs font-medium">Clique para abrir</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative cursor-pointer hover:opacity-90 transition-opacity border border-border rounded-lg overflow-hidden bg-white"
      onClick={onClick}
      style={{ width: '200px', height: '260px' }}
    >
      {/* Loading state */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <span className="text-xs text-muted-foreground">Carregando...</span>
        </div>
      )}

      {/* PDF Thumbnail usando react-pdf */}
      <div className="w-full h-full overflow-hidden pdf-thumbnail-container">
        <Document
          file={url}
          onLoadSuccess={() => {
            setPdfLoaded(true);
            setLoading(false);
          }}
          onLoadError={() => {
            setError(true);
            setLoading(false);
          }}
          loading={null}
        >
          <Page 
            pageNumber={1} 
            width={198}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="pdf-page-thumbnail"
          />
        </Document>
      </div>

      {/* Overlay com nome do arquivo */}
      {!loading && pdfLoaded && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 pointer-events-none">
          <div className="text-white text-xs font-medium truncate flex items-center gap-1">
            <FileText className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{fileName || 'Documento PDF'}</span>
          </div>
        </div>
      )}

      {/* Click overlay */}
      {!loading && pdfLoaded && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30">
          <div className="flex items-center gap-1 text-white bg-primary/80 px-3 py-1.5 rounded-full">
            <Eye className="h-3 w-3" />
            <span className="text-xs font-medium">Clique para abrir</span>
          </div>
        </div>
      )}
    </div>
  );
}
