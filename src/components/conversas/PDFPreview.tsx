import { FileText, Eye } from 'lucide-react';

interface PDFPreviewProps {
  url: string;
  fileName?: string;
  onClick?: () => void;
}

export function PDFPreview({ url, fileName, onClick }: PDFPreviewProps) {
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
