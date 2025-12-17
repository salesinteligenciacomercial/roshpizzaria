import { FileText, Eye } from 'lucide-react';

interface PDFPreviewProps {
  url: string;
  fileName?: string;
  onClick?: () => void;
}

export function PDFPreview({ url, fileName, onClick }: PDFPreviewProps) {
  return (
    <div 
      className="relative cursor-pointer hover:opacity-90 transition-opacity border border-border rounded-lg overflow-hidden bg-gradient-to-b from-muted/20 to-muted/50"
      onClick={onClick}
      style={{ width: '200px', height: '120px' }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center p-3">
        <FileText className="h-10 w-10 text-red-500 mb-1" />
        <p className="text-xs text-center text-muted-foreground font-medium line-clamp-1 px-2 max-w-full">
          {fileName || 'Documento PDF'}
        </p>
        <div className="flex items-center gap-1 mt-1.5 text-primary bg-background/80 px-2 py-1 rounded-full text-[10px]">
          <Eye className="h-2.5 w-2.5" />
          <span className="font-medium">Clique para abrir</span>
        </div>
      </div>
    </div>
  );
}
