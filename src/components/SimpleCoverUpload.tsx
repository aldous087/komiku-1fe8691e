import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Image as ImageIcon, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { secureUploadCover } from "@/lib/secure-storage";

interface SimpleCoverUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  komikId?: string;
}

export const SimpleCoverUpload = ({ value, onChange, komikId }: SimpleCoverUploadProps) => {
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setUploading(true);

      try {
        // Use a temporary ID if komikId not provided (for new comics)
        const uploadId = komikId || crypto.randomUUID();
        const publicUrl = await secureUploadCover(file, uploadId);
        onChange(publicUrl);
        toast.success("Cover uploaded successfully");
      } catch (error) {
        console.error("Upload error:", error);
        toast.error(error instanceof Error ? error.message : "Failed to upload cover");
      } finally {
        setUploading(false);
      }
    },
    [onChange, komikId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
    maxSize: 15728640, // 15MB
  });

  const handleRemove = () => {
    onChange(null);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Comic Cover</h3>
        {value && (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={handleRemove}
          >
            <X className="w-4 h-4 mr-1" />
            Remove
          </Button>
        )}
      </div>

      {value && (
        <div className="mb-4">
          <img
            src={value}
            alt="Cover preview"
            className="w-full max-w-sm h-auto rounded-lg"
          />
        </div>
      )}

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          {uploading ? (
            <Upload className="h-12 w-12 text-muted-foreground animate-pulse" />
          ) : (
            <ImageIcon className="h-12 w-12 text-muted-foreground" />
          )}
          <p className="text-sm font-medium">
            {uploading
              ? "Uploading..."
              : isDragActive
              ? "Drop file here..."
              : "Drag & drop cover, or click to select"}
          </p>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, WEBP (Max 15MB)
          </p>
        </div>
      </div>
    </Card>
  );
};
