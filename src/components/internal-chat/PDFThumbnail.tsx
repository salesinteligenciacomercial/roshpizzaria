import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PDFThumbnailProps {
  url: string;
  className?: string;
  onClick?: () => void;
}

export const PDFThumbnail = ({ url, className = '', onClick }: PDFThumbnailProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadPDF = async () => {
      if (!canvasRef.current) return;

      try {
        setLoading(true);
        setError(false);

        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        // Scale to fit the container while maintaining aspect ratio
        const viewport = page.getViewport({ scale: 0.5 });
        const maxWidth = 200;
        const scale = maxWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
          canvas: canvas,
        }).promise;

        setLoading(false);
      } catch (err) {
        console.error('Error loading PDF thumbnail:', err);
        setError(true);
        setLoading(false);
      }
    };

    loadPDF();
  }, [url]);

  if (error) {
    return (
      <div 
        className={`flex items-center justify-center bg-muted rounded-lg ${className}`}
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
          className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg"
          style={{ width: 200, height: 150 }}
        >
          <div className="animate-pulse">
            <FileText className="w-12 h-12 text-muted-foreground" />
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`rounded-lg shadow-sm border ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
      />
    </div>
  );
};
