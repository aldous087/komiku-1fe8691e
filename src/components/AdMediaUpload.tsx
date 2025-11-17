import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Image as ImageIcon, Video } from "lucide-react";
import { Card } from "@/components/ui/card";
import { uploadAdImage, uploadAdVideo } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";

interface AdMediaUploadProps {
  type: "image" | "video";
  onUploadSuccess: (url: string) => void;
  currentUrl?: string;
}

export const AdMediaUpload = ({
  type,
  onUploadSuccess,
  currentUrl,
}: AdMediaUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentUrl);
  const { toast } = useToast();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setUploading(true);

      try {
        const url =
          type === "image"
            ? await uploadAdImage(file)
            : await uploadAdVideo(file);

        setPreviewUrl(url);
        onUploadSuccess(url);

        toast({
          title: "Berhasil",
          description: `${type === "image" ? "Gambar" : "Video"} berhasil diupload`,
        });
      } catch (error) {
        console.error("Upload error:", error);
        toast({
          title: "Error",
          description: `Gagal upload ${type === "image" ? "gambar" : "video"}`,
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    },
    [type, onUploadSuccess, toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept:
      type === "image"
        ? {
            "image/jpeg": [".jpg", ".jpeg"],
            "image/png": [".png"],
            "image/webp": [".webp"],
          }
        : {
            "video/mp4": [".mp4"],
          },
    maxFiles: 1,
    maxSize: type === "image" ? 15728640 : 83886080, // 15MB for image, 80MB for video
  });

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">
        Upload {type === "image" ? "Gambar HD" : "Video MP4 HD"}
      </h3>

      {previewUrl && (
        <div className="mb-4">
          {type === "image" ? (
            <img
              src={previewUrl}
              alt="Ad preview"
              className="w-full max-w-sm h-auto rounded-lg"
            />
          ) : (
            <video
              src={previewUrl}
              controls
              className="w-full max-w-sm rounded-lg"
            />
          )}
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
          ) : type === "image" ? (
            <ImageIcon className="h-12 w-12 text-muted-foreground" />
          ) : (
            <Video className="h-12 w-12 text-muted-foreground" />
          )}
          <p className="text-sm font-medium">
            {uploading
              ? "Mengupload..."
              : isDragActive
              ? "Drop file di sini..."
              : `Drag & drop ${type === "image" ? "gambar" : "video"}, atau klik untuk pilih`}
          </p>
          <p className="text-xs text-muted-foreground">
            {type === "image"
              ? "JPG, PNG, WEBP (Max 15MB)"
              : "MP4 H.264 (Max 80MB)"}
          </p>
        </div>
      </div>
    </Card>
  );
};
