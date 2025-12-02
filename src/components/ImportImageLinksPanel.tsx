import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link2, CheckCircle, XCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { isValidImageUrl, parseImageUrlsFromText, validateImageUrls } from "@/lib/security-utils";

interface ImportImageLinksPanelProps {
  onImportSuccess: (urls: string[]) => void;
  disabled?: boolean;
}

export const ImportImageLinksPanel = ({
  onImportSuccess,
  disabled = false,
}: ImportImageLinksPanelProps) => {
  const [urlText, setUrlText] = useState("");
  const [validationResults, setValidationResults] = useState<{
    valid: string[];
    invalid: Array<{ url: string; error: string }>;
  } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleValidate = () => {
    setIsValidating(true);
    
    const urls = parseImageUrlsFromText(urlText);
    
    if (urls.length === 0) {
      setValidationResults({ valid: [], invalid: [] });
      setIsValidating(false);
      return;
    }

    const results = validateImageUrls(urls);
    setValidationResults(results);
    setIsValidating(false);
  };

  const handleImport = () => {
    if (validationResults && validationResults.valid.length > 0) {
      onImportSuccess(validationResults.valid);
      // Clear form after successful import
      setUrlText("");
      setValidationResults(null);
      setShowPreview(false);
    }
  };

  const handleClear = () => {
    setUrlText("");
    setValidationResults(null);
    setShowPreview(false);
  };

  const totalUrls = parseImageUrlsFromText(urlText).length;

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Link2 className="h-5 w-5" />
        Import dari Link Gambar (Hotlink Mode)
      </h3>
      
      <p className="text-sm text-muted-foreground mb-4">
        Masukkan URL gambar (satu per baris). Gambar tidak akan diupload ke storage, 
        hanya link-nya yang disimpan. Loading chapter lebih cepat dan hemat storage.
      </p>

      <Textarea
        placeholder={`https://cdn.example.com/chapter1/page001.jpg
https://cdn.example.com/chapter1/page002.jpg
https://cdn.example.com/chapter1/page003.jpg`}
        value={urlText}
        onChange={(e) => {
          setUrlText(e.target.value);
          setValidationResults(null); // Reset validation when text changes
        }}
        rows={8}
        disabled={disabled}
        className="font-mono text-sm"
      />

      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-muted-foreground">
          {totalUrls} URL terdeteksi
        </p>
        <p className="text-xs text-muted-foreground">
          Format: JPG, PNG, WEBP, GIF
        </p>
      </div>

      {/* Validation Results */}
      {validationResults && (
        <div className="mt-4 space-y-3">
          {validationResults.valid.length > 0 && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                {validationResults.valid.length} URL valid dan siap diimport
              </AlertDescription>
            </Alert>
          )}

          {validationResults.invalid.length > 0 && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-2">
                  {validationResults.invalid.length} URL tidak valid:
                </p>
                <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                  {validationResults.invalid.slice(0, 5).map((item, idx) => (
                    <li key={idx} className="truncate">
                      • {item.url.substring(0, 50)}... — {item.error}
                    </li>
                  ))}
                  {validationResults.invalid.length > 5 && (
                    <li className="text-muted-foreground">
                      ... dan {validationResults.invalid.length - 5} lainnya
                    </li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Preview Section */}
      {showPreview && validationResults && validationResults.valid.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">
            Preview ({validationResults.valid.length} gambar):
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-64 overflow-y-auto p-2 bg-muted/30 rounded-lg">
            {validationResults.valid.map((url, index) => (
              <div key={index} className="relative aspect-[3/4] group">
                <img
                  src={url}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-cover rounded border border-border"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder.svg';
                    (e.target as HTMLImageElement).classList.add('opacity-50');
                  }}
                />
                <div className="absolute top-1 right-1 bg-background/80 px-1.5 py-0.5 rounded text-xs font-mono">
                  {String(index + 1).padStart(3, '0')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleValidate}
          disabled={disabled || isValidating || totalUrls === 0}
        >
          {isValidating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Memvalidasi...
            </>
          ) : (
            'Validasi URL'
          )}
        </Button>

        {validationResults && validationResults.valid.length > 0 && (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Sembunyikan Preview
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Lihat Preview
                </>
              )}
            </Button>

            <Button
              type="button"
              onClick={handleImport}
              disabled={disabled}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Import {validationResults.valid.length} Gambar
            </Button>
          </>
        )}

        {urlText.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleClear}
            disabled={disabled}
          >
            Clear
          </Button>
        )}
      </div>

      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground">
          <strong>Tips:</strong> Gunakan URL dari CDN yang reliable seperti imgur, 
          Discord CDN, atau CDN sumber komik. Gambar akan dimuat langsung dari URL 
          aslinya tanpa melalui server kami.
        </p>
      </div>
    </Card>
  );
};
