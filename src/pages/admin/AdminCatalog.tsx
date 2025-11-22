import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Download, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";

export default function AdminCatalog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFetching, setIsFetching] = useState(false);

  // Fetch scrape logs
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["scrape-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scrape_logs")
        .select(`
          *,
          sources (name, code)
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  // Fetch comics count
  const { data: comicsCount } = useQuery({
    queryKey: ["comics-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("komik")
        .select("*", { count: "exact", head: true });

      if (error) throw error;
      return count || 0;
    },
  });

  // Fetch all comics mutation
  const fetchAllComicsMutation = useMutation({
    mutationFn: async () => {
      setIsFetching(true);
      const { data, error } = await supabase.functions.invoke("fetch-comic-list", {
        body: { sourceCode: "ALL", maxPages: 10 },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Berhasil!",
        description: `${data.totalComics} komik berhasil diambil dari semua source.`,
      });
      queryClient.invalidateQueries({ queryKey: ["scrape-logs"] });
      queryClient.invalidateQueries({ queryKey: ["comics-count"] });
      setIsFetching(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Gagal mengambil komik",
        description: error.message,
        variant: "destructive",
      });
      setIsFetching(false);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Catalog Management</h1>
        <p className="text-muted-foreground">
          Kelola dan sinkronisasi katalog komik dari semua sumber
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Komik</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{comicsCount || 0}</div>
            <p className="text-xs text-muted-foreground">Komik di database</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Status Scraper</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isFetching ? <Loader2 className="h-6 w-6 animate-spin" /> : "Ready"}
            </div>
            <p className="text-xs text-muted-foreground">
              {isFetching ? "Sedang mengambil data..." : "Siap digunakan"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Terakhir Sync</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {logs && logs.length > 0
                ? formatDistanceToNow(new Date(logs[0].created_at!), {
                    addSuffix: true,
                    locale: id,
                  })
                : "Belum ada"}
            </div>
            <p className="text-xs text-muted-foreground">Aktivitas terakhir</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Aksi Catalog</CardTitle>
          <CardDescription>
            Ambil atau perbarui komik dari semua sumber secara otomatis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              onClick={() => fetchAllComicsMutation.mutate()}
              disabled={isFetching}
              className="gap-2"
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Fetch All Comics (10 Pages)
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["scrape-logs"] });
                queryClient.invalidateQueries({ queryKey: ["comics-count"] });
                toast({
                  title: "Data direfresh",
                  description: "Logs dan statistik telah diperbarui",
                });
              }}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Data
            </Button>
          </div>

          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
            <p className="text-sm text-yellow-500">
              ⚠️ Proses fetching semua komik memakan waktu 5-10 menit tergantung jumlah
              halaman. Pastikan koneksi stabil.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Scrape Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Scraping Logs</CardTitle>
          <CardDescription>Riwayat aktivitas scraping dari semua sumber</CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">
                        {formatDistanceToNow(new Date(log.created_at!), {
                          addSuffix: true,
                          locale: id,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.sources?.code}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{log.action}</TableCell>
                      <TableCell>
                        <Badge
                          variant={log.status === "SUCCESS" ? "default" : "destructive"}
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs">
                        {log.target_url}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-red-500">
                        {log.error_message}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-muted-foreground">Belum ada aktivitas scraping</p>
              <p className="text-sm text-muted-foreground">
                Klik "Fetch All Comics" untuk memulai
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
