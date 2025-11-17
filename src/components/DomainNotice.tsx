import { Card } from "@/components/ui/card";

export const DomainNotice = () => {
  return (
    <Card className="mx-4 mb-6 p-4 bg-background border-2 border-border rounded-2xl shadow-lg">
      <p className="text-center text-sm md:text-base">
        <span className="text-foreground font-normal">Simpan domain utama kami di </span>
        <span className="text-red-500 font-bold">[KOMIKU.AE]</span>
      </p>
    </Card>
  );
};
