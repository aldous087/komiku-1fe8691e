import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

interface AdFormData {
  position: string;
  image_url: string;
  link_url: string;
  is_active: boolean;
}

const AdminAdForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const [isActive, setIsActive] = useState(true);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<AdFormData>();

  const { data: ad } = useQuery({
    queryKey: ["ad", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("ads")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (ad) {
      setValue("position", ad.position);
      setValue("image_url", ad.image_url);
      setValue("link_url", ad.link_url || "");
      setIsActive(ad.is_active);
    }
  }, [ad, setValue]);

  const saveMutation = useMutation({
    mutationFn: async (data: AdFormData) => {
      const adData = {
        position: data.position,
        image_url: data.image_url,
        link_url: data.link_url,
        is_active: isActive,
      };

      if (isEdit) {
        const { error } = await supabase
          .from("ads")
          .update(adData)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ads")
          .insert(adData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Iklan berhasil diupdate" : "Iklan berhasil ditambahkan");
      queryClient.invalidateQueries({ queryKey: ["admin-ads-list"] });
      navigate("/admin/ads");
    },
    onError: (error: any) => {
      toast.error(error.message || "Terjadi kesalahan");
    },
  });

  const onSubmit = (data: AdFormData) => {
    saveMutation.mutate(data);
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/ads")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">{isEdit ? "Edit Iklan" : "Tambah Iklan"}</h1>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <Label htmlFor="position">Posisi</Label>
            <Input
              id="position"
              {...register("position", { required: "Posisi harus diisi" })}
              placeholder="home-top / detail-sidebar"
            />
            {errors.position && <p className="text-sm text-destructive mt-1">{errors.position.message}</p>}
          </div>

          <div>
            <Label htmlFor="image_url">URL Gambar</Label>
            <Input
              id="image_url"
              {...register("image_url", { required: "URL gambar harus diisi" })}
              placeholder="https://example.com/ad.jpg"
            />
            {errors.image_url && <p className="text-sm text-destructive mt-1">{errors.image_url.message}</p>}
          </div>

          <div>
            <Label htmlFor="link_url">URL Link (opsional)</Label>
            <Input
              id="link_url"
              {...register("link_url")}
              placeholder="https://example.com"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="is_active">Aktifkan iklan</Label>
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/admin/ads")}>
              Batal
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default AdminAdForm;
