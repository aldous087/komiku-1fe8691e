import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

interface ChapterFormData {
  komik_id: string;
  chapter_number: string;
  title: string;
  images: string;
}

const AdminChapterForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const [selectedKomikId, setSelectedKomikId] = useState("");

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<ChapterFormData>();

  const { data: komikList } = useQuery({
    queryKey: ["admin-komik-list-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("komik")
        .select("id, title")
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const { data: chapter } = useQuery({
    queryKey: ["chapter", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("chapters")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  const { data: chapterImages } = useQuery({
    queryKey: ["chapter-images", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("chapter_images")
        .select("*")
        .eq("chapter_id", id)
        .order("order_index");
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (chapter) {
      setValue("komik_id", chapter.komik_id);
      setSelectedKomikId(chapter.komik_id);
      setValue("chapter_number", chapter.chapter_number.toString());
      setValue("title", chapter.title || "");
    }
    if (chapterImages) {
      const imageUrls = chapterImages.map(img => img.image_url).join("\n");
      setValue("images", imageUrls);
    }
  }, [chapter, chapterImages, setValue]);

  const saveMutation = useMutation({
    mutationFn: async (data: ChapterFormData) => {
      const chapterData = {
        komik_id: selectedKomikId,
        chapter_number: parseFloat(data.chapter_number),
        title: data.title,
      };

      let chapterId = id;

      if (isEdit) {
        const { error } = await supabase
          .from("chapters")
          .update(chapterData)
          .eq("id", id);
        if (error) throw error;

        // Delete old images
        await supabase
          .from("chapter_images")
          .delete()
          .eq("chapter_id", id);
      } else {
        const { data: newChapter, error } = await supabase
          .from("chapters")
          .insert(chapterData)
          .select()
          .single();
        if (error) throw error;
        chapterId = newChapter.id;
      }

      // Insert images
      const imageUrls = data.images.split("\n").map(url => url.trim()).filter(Boolean);
      const imageData = imageUrls.map((url, index) => ({
        chapter_id: chapterId,
        image_url: url,
        order_index: index,
      }));

      if (imageData.length > 0) {
        const { error } = await supabase
          .from("chapter_images")
          .insert(imageData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Chapter berhasil diupdate" : "Chapter berhasil ditambahkan");
      queryClient.invalidateQueries({ queryKey: ["admin-chapters-list"] });
      navigate("/admin/chapters");
    },
    onError: (error: any) => {
      toast.error(error.message || "Terjadi kesalahan");
    },
  });

  const onSubmit = (data: ChapterFormData) => {
    if (!selectedKomikId) {
      toast.error("Pilih komik terlebih dahulu");
      return;
    }
    saveMutation.mutate(data);
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/chapters")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">{isEdit ? "Edit Chapter" : "Tambah Chapter"}</h1>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <Label htmlFor="komik_id">Komik</Label>
            <Select value={selectedKomikId} onValueChange={setSelectedKomikId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih komik" />
              </SelectTrigger>
              <SelectContent>
                {komikList?.map((komik) => (
                  <SelectItem key={komik.id} value={komik.id}>
                    {komik.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="chapter_number">Nomor Chapter</Label>
            <Input
              id="chapter_number"
              type="number"
              step="0.1"
              {...register("chapter_number", { required: "Nomor chapter harus diisi" })}
              placeholder="1"
            />
            {errors.chapter_number && <p className="text-sm text-destructive mt-1">{errors.chapter_number.message}</p>}
          </div>

          <div>
            <Label htmlFor="title">Judul Chapter (opsional)</Label>
            <Input
              id="title"
              {...register("title")}
              placeholder="Judul chapter"
            />
          </div>

          <div>
            <Label htmlFor="images">URL Gambar (satu per baris)</Label>
            <textarea
              id="images"
              {...register("images")}
              className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
            />
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/admin/chapters")}>
              Batal
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default AdminChapterForm;
