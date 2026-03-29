import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Send, Crop, RotateCcw } from "lucide-react";

interface PastedImagePreviewProps {
  imageFile: File;
  onSend: (file: File, caption: string) => void;
  onCancel: () => void;
}

export function PastedImagePreview({ imageFile, onSend, onCancel }: PastedImagePreviewProps) {
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [isCropping, setIsCropping] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const getRelativePos = (e: React.MouseEvent) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isCropping) return;
    e.preventDefault();
    setCropStart(getRelativePos(e));
    setCropEnd(null);
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !isCropping) return;
    setCropEnd(getRelativePos(e));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const getCropRect = () => {
    if (!cropStart || !cropEnd) return null;
    return {
      left: Math.min(cropStart.x, cropEnd.x) * 100,
      top: Math.min(cropStart.y, cropEnd.y) * 100,
      width: Math.abs(cropEnd.x - cropStart.x) * 100,
      height: Math.abs(cropEnd.y - cropStart.y) * 100,
    };
  };

  const applyCrop = useCallback(async () => {
    if (!cropStart || !cropEnd || !imgRef.current) return;
    const img = imgRef.current;
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;

    const x = Math.min(cropStart.x, cropEnd.x) * naturalW;
    const y = Math.min(cropStart.y, cropEnd.y) * naturalH;
    const w = Math.abs(cropEnd.x - cropStart.x) * naturalW;
    const h = Math.abs(cropEnd.y - cropStart.y) * naturalH;

    if (w < 10 || h < 10) {
      setCropStart(null);
      setCropEnd(null);
      setIsCropping(false);
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, x, y, w, h, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) return;

    const croppedFile = new File([blob], imageFile.name || "screenshot.png", { type: "image/png" });
    setCropStart(null);
    setCropEnd(null);
    setIsCropping(false);
    onSend(croppedFile, caption);
  }, [cropStart, cropEnd, imageFile, caption, onSend]);

  const handleSend = () => {
    if (isCropping && cropStart && cropEnd) {
      applyCrop();
    } else {
      onSend(imageFile, caption);
    }
  };

  const cropRect = getCropRect();

  return (
    <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-sm font-medium text-foreground">Imagem colada</span>
        <div className="flex items-center gap-1">
          <Button
            variant={isCropping ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setIsCropping(!isCropping);
              setCropStart(null);
              setCropEnd(null);
            }}
            className="gap-1"
          >
            <Crop className="h-4 w-4" />
            Recortar
          </Button>
          {isCropping && cropStart && cropEnd && (
            <Button variant="outline" size="sm" onClick={() => { setCropStart(null); setCropEnd(null); }} className="gap-1">
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center p-4 overflow-hidden relative select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isCropping ? "crosshair" : "default" }}
      >
        <div className="relative max-w-full max-h-full">
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Preview"
            className="max-w-full max-h-[60vh] object-contain rounded-lg"
            draggable={false}
          />
          {/* Crop overlay */}
          {isCropping && cropRect && cropRect.width > 0 && (
            <>
              {/* Dim area outside crop */}
              <div className="absolute inset-0 bg-black/50 rounded-lg" style={{ clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% ${cropRect.top}%, ${cropRect.left}% ${cropRect.top}%, ${cropRect.left}% ${cropRect.top + cropRect.height}%, ${cropRect.left + cropRect.width}% ${cropRect.top + cropRect.height}%, ${cropRect.left + cropRect.width}% ${cropRect.top}%, 0% ${cropRect.top}%)` }} />
              {/* Crop border */}
              <div
                className="absolute border-2 border-primary rounded"
                style={{
                  left: `${cropRect.left}%`,
                  top: `${cropRect.top}%`,
                  width: `${cropRect.width}%`,
                  height: `${cropRect.height}%`,
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="px-4 py-3 border-t border-border flex items-end gap-2">
        <Textarea
          placeholder="Adicionar legenda..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="flex-1 min-h-[40px] max-h-[100px] resize-none"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button onClick={handleSend} size="icon" className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
