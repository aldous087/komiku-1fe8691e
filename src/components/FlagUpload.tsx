import { useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { uploadCountryFlag } from "@/lib/storage";

interface FlagUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
}

export const FlagUpload = ({ value, onChange }: FlagUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(value);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const publicUrl = await uploadCountryFlag(file);
      setPreview(publicUrl);
      onChange(publicUrl);
      toast.success("Flag uploaded successfully");
    } catch (error) {
      console.error("Error uploading flag:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload flag");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Country Flag</label>
      <div className="flex items-center gap-4">
        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt="Flag preview"
              className="w-16 h-12 object-cover rounded border-2 border-border"
            />
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
              onClick={handleRemove}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="w-16 h-12 border-2 border-dashed border-border rounded flex items-center justify-center">
            <span className="text-xs text-muted-foreground">No flag</span>
          </div>
        )}

        <div>
          <input
            type="file"
            id="flag-upload"
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
          />
          <label htmlFor="flag-upload">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              asChild
            >
              <span className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? "Uploading..." : "Upload Flag"}
              </span>
            </Button>
          </label>
          <p className="text-xs text-muted-foreground mt-1">
            Recommended: 32x24px, max 2MB
          </p>
        </div>
      </div>
    </div>
  );
};
