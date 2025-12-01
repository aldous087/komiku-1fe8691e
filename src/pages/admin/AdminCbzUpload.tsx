import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, FileArchive, CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface UploadResult {
  success: boolean;
  comic_id: string;
  chapter_id: string;
  chapter_number: number;
  total_pages: number;
  metadata: any;
  html_url: string;
  images_url: string[];
}

export default function AdminCbzUpload() {
  const [selectedComicId, setSelectedComicId] = useState<string>("");
  const [chapterNumber, setChapterNumber] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const queryClient = useQueryClient();

  // Fetch comics for dropdown
  const { data: comics, isLoading: loadingComics } = useQuery({
    queryKey: ["admin-comics-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("komik")
        .select("id, title, slug")
        .order("title");
      
      if (error) throw error;
      return data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("upload-cbz", {
        body: formData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      return response.data as UploadResult;
    },
    onSuccess: (data) => {
      setUploadResult(data);
      setSelectedFile(null);
      setChapterNumber("");
      toast.success("CBZ berhasil diupload!", {
        description: `${data.total_pages} halaman telah diproses`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-chapters"] });
      queryClient.invalidateQueries({ queryKey: ["admin-comics-list"] });
    },
    onError: (error: any) => {
      console.error("Upload error:", error);
      toast.error("Gagal upload CBZ", {
        description: error.message || "Terjadi kesalahan",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith(".cbz")) {
        toast.error("File harus berformat .cbz");
        return;
      }
      setSelectedFile(file);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Pilih file CBZ terlebih dahulu");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    
    if (selectedComicId) {
      formData.append("comic_id", selectedComicId);
    }
    
    if (chapterNumber) {
      formData.append("chapter_number", chapterNumber);
    }

    uploadMutation.mutate(formData);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Upload CBZ</h1>
        <p className="text-muted-foreground">
          Upload file Comic Book Archive (.cbz) dengan auto-detect metadata dan kompresi otomatis
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileArchive className="h-5 w-5" />
              Upload Form
            </CardTitle>
            <CardDescription>
              Pilih komik (opsional), chapter number (opsional), dan file CBZ
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="comic-select">Komik (Opsional)</Label>
              <Select value={selectedComicId} onValueChange={(value) => setSelectedComicId(value === "auto-create" ? "" : value)}>
                <SelectTrigger id="comic-select">
                  <SelectValue placeholder="Auto-create dari metadata" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="auto-create">Auto-create dari metadata</SelectItem>
                  {loadingComics ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : (
                    comics?.map((comic) => (
                      <SelectItem key={comic.id} value={comic.id}>
                        {comic.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Pilih "Auto-create" untuk membuat komik baru secara otomatis dari metadata CBZ
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chapter-number">Nomor Chapter (Opsional)</Label>
              <Input
                id="chapter-number"
                type="number"
                placeholder="Auto-detect dari nama file"
                value={chapterNumber}
                onChange={(e) => setChapterNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Kosongkan untuk auto-detect dari nama file atau ComicInfo.xml
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cbz-file">File CBZ *</Label>
              <Input
                id="cbz-file"
                type="file"
                accept=".cbz,application/vnd.comicbook+zip,application/zip"
                onChange={handleFileChange}
                disabled={uploadMutation.isPending}
              />
              {selectedFile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileArchive className="h-4 w-4" />
                  {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}
            </div>

            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
              className="w-full"
            >
              {uploadMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload & Process CBZ
                </>
              )}
            </Button>

            <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
              <h4 className="font-semibold">Fitur Auto:</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Auto-detect judul & chapter dari nama file</li>
                <li>Parse ComicInfo.xml (jika tersedia)</li>
                <li>Auto-compress gambar ke WebP</li>
                <li>Auto-sort halaman secara numerik</li>
                <li>Auto-generate info.html</li>
                <li>Auto-upload ke Cloudflare R2</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Result Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {uploadResult ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
              )}
              Upload Result
            </CardTitle>
            <CardDescription>
              {uploadResult ? "Upload berhasil!" : "Hasil akan ditampilkan di sini"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {uploadResult ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Chapter Number:</span>
                    <Badge variant="outline">{uploadResult.chapter_number}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total Pages:</span>
                    <Badge variant="outline">{uploadResult.total_pages}</Badge>
                  </div>
                </div>

                {uploadResult.metadata && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Metadata:</h4>
                    {uploadResult.metadata.series && (
                      <div className="text-sm">
                        <span className="font-medium">Series:</span> {uploadResult.metadata.series}
                      </div>
                    )}
                    {uploadResult.metadata.title && (
                      <div className="text-sm">
                        <span className="font-medium">Title:</span> {uploadResult.metadata.title}
                      </div>
                    )}
                    {uploadResult.metadata.summary && (
                      <div className="text-sm">
                        <span className="font-medium">Summary:</span>
                        <p className="text-muted-foreground mt-1">{uploadResult.metadata.summary}</p>
                      </div>
                    )}
                    {uploadResult.metadata.genres && uploadResult.metadata.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {uploadResult.metadata.genres.map((genre: string, i: number) => (
                          <Badge key={i} variant="secondary">{genre}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(`/komik/${uploadResult.comic_id}`, "_blank")}
                  >
                    Buka Komik
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(uploadResult.html_url, "_blank")}
                  >
                    Lihat Info HTML
                  </Button>
                </div>

                <Accordion type="single" collapsible>
                  <AccordionItem value="raw-data">
                    <AccordionTrigger>Raw JSON Data</AccordionTrigger>
                    <AccordionContent>
                      <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-96">
                        {JSON.stringify(uploadResult, null, 2)}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileArchive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Upload CBZ untuk melihat hasil</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-3 mt-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">ComicInfo.xml</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Jika tersedia, metadata akan diambil dari ComicInfo.xml. Jika tidak, sistem akan auto-detect dari nama file.
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Auto Compression</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Semua gambar akan dikompres ke WebP dengan kualitas optimal dan resolusi maksimal 1600px.
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Cloudflare R2</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            File akan diupload ke R2 dengan struktur: comics/{"{comic_id}"}/chapters/{"{chapter}"}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
