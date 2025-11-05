import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip } from "lucide-react";

interface MediaUploadProps {
  onFileSelected: (file: File) => void;
}

export function MediaUpload({ onFileSelected }: MediaUploadProps) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      onFileSelected(file);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative">
              <input
                type="file"
        id="media-upload"
                className="hidden"
        onChange={handleFileChange}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
        disabled={uploading}
              />
                <Button
        type="button"
        variant="ghost"
                  size="icon"
        onClick={() => document.getElementById('media-upload')?.click()}
                  disabled={uploading}
      >
        <Paperclip className="h-4 w-4" />
                </Button>
              </div>
  );
}
