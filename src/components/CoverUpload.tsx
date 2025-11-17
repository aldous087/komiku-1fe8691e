import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { uploadComicCover } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";

interface CoverUploadProps {
  komikId: string;
  currentCoverUrl?: string;
  onUploadSuccess: (url: string) => void;
}

export const CoverUpload = ({
  komikId,
  currentCoverUrl,
  onUploadSuccess,
}: CoverUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentCoverUrl);
  const { toast } = useToast();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setUploading(true);

      try {
        const url = await uploadComicCover(file, komikId);
        setPreviewUrl(url);
        onUploadSuccess(url);
        toast({
          title: "Berhasil",
          description: "Cover berhasil diupload",
        });
      } catch (error) {
        console.error("Upload error:", error);
        toast({
          title: "Error",
          description: "Gagal upload cover",
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    },
    [komikId, onUploadSuccess, toast]
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

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Upload Cover Komik HD</h3>
      
      {previewUrl && (
        <div className="mb-4">
          <img
            src={previewUrl}
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
              ? "Mengupload..."
              : isDragActive
              ? "Drop file di sini..."
              : "Drag & drop cover, atau klik untuk pilih"}
          </p>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, WEBP (Max 15MB)
          </p>
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full mt-4"
        disabled={uploading}
        onClick={() => {}}
      >
        {previewUrl ? "Ganti Cover" : "Upload Cover"}
      </Button>
    </Card>
  );
};
