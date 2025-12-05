import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FileText } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFThumbnailProps {
  url: string;
  className?: string;
  onClick?: () => void;
}

export const PDFThumbnail = ({ url, className = '', onClick }: PDFThumbnailProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div 
        className={`flex items-center justify-center bg-muted rounded-lg cursor-pointer ${className}`}
        style={{ width: 200, height: 150 }}
        onClick={onClick}
      >
        <FileText className="w-12 h-12 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`relative cursor-pointer ${className}`} onClick={onClick}>
      {loading && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg z-10"
          style={{ width: 200, height: 150 }}
        >
          <div className="animate-pulse">
            <FileText className="w-12 h-12 text-muted-foreground" />
          </div>
        </div>
      )}
      <Document
        file={url}
        onLoadSuccess={() => setLoading(false)}
        onLoadError={() => {
          setError(true);
          setLoading(false);
        }}
        loading={null}
        className="rounded-lg overflow-hidden shadow-sm border"
      >
        <Page 
          pageNumber={1} 
          width={200}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </Document>
    </div>
  );
};
