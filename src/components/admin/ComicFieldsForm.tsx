import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useState } from "react";

interface ComicFieldsFormProps {
  form: UseFormReturn<any>;
}

const AVAILABLE_GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror",
  "Mystery", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural",
  "Thriller", "Martial Arts", "Shounen", "Seinen", "Shoujo", "Manhwa", "Manhua"
];

const COUNTRIES = [
  { code: "jp", name: "Japan", flag: "🇯🇵" },
  { code: "kr", name: "Korea", flag: "🇰🇷" },
  { code: "cn", name: "China", flag: "🇨🇳" },
  { code: "us", name: "United States", flag: "🇺🇸" },
  { code: "id", name: "Indonesia", flag: "🇮🇩" },
];

export const ComicFieldsForm = ({ form }: ComicFieldsFormProps) => {
  const [genreInput, setGenreInput] = useState("");
  const selectedGenres = form.watch("genres") || [];

  const addGenre = (genre: string) => {
    if (genre && !selectedGenres.includes(genre)) {
      form.setValue("genres", [...selectedGenres, genre]);
      setGenreInput("");
    }
  };

  const removeGenre = (genre: string) => {
    form.setValue("genres", selectedGenres.filter((g: string) => g !== genre));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Title *</FormLabel>
            <FormControl>
              <Input placeholder="Enter comic title" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="slug"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Slug *</FormLabel>
            <FormControl>
              <Input placeholder="comic-slug" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea 
                placeholder="Enter comic description" 
                className="min-h-[100px]"
                {...field} 
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="origin_country"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Origin Country</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country.code} value={country.name}>
                    {country.flag} {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="status"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Status</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="Ongoing">Ongoing</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Hiatus">Hiatus</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="rating_admin"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Rating (0-10)</FormLabel>
            <FormControl>
              <Input 
                type="number" 
                min="0" 
                max="10" 
                step="0.1"
                placeholder="7.5" 
                {...field}
                onChange={(e) => field.onChange(parseFloat(e.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="chapter_count"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Chapter Count</FormLabel>
            <FormControl>
              <Input 
                type="number" 
                min="0"
                placeholder="123" 
                {...field}
                onChange={(e) => field.onChange(parseInt(e.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="is_color"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Color Comic (WARNA)</FormLabel>
              <p className="text-sm text-muted-foreground">
                Is this a colored comic?
              </p>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />

      <FormItem className="md:col-span-2">
        <FormLabel>Genres</FormLabel>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Select value={genreInput} onValueChange={(value) => {
              addGenre(value);
            }}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select genre" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_GENRES.map((genre) => (
                  <SelectItem key={genre} value={genre}>
                    {genre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedGenres.map((genre: string) => (
              <Badge key={genre} variant="secondary" className="gap-1">
                {genre}
                <X 
                  className="w-3 h-3 cursor-pointer" 
                  onClick={() => removeGenre(genre)}
                />
              </Badge>
            ))}
          </div>
        </div>
      </FormItem>

      <FormField
        control={form.control}
        name="dominant_color"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Dominant Color (Auto-filled)</FormLabel>
            <FormControl>
              <Input 
                placeholder="#000000" 
                {...field} 
                disabled
                className="bg-muted"
              />
            </FormControl>
            <p className="text-xs text-muted-foreground">
              This field is automatically filled when cover is uploaded
            </p>
          </FormItem>
        )}
      />

      <div className="md:col-span-2 grid grid-cols-3 gap-4">
        <FormItem>
          <FormLabel>Views Today</FormLabel>
          <Input 
            type="number"
            value={form.watch("views_today") || 0}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">Auto-tracked</p>
        </FormItem>

        <FormItem>
          <FormLabel>Views Week</FormLabel>
          <Input 
            type="number"
            value={form.watch("views_week") || 0}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">Auto-tracked</p>
        </FormItem>

        <FormItem>
          <FormLabel>Popularity Score</FormLabel>
          <Input 
            type="number"
            value={form.watch("popularity_score") || 0}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">Auto-calculated</p>
        </FormItem>
      </div>
    </div>
  );
};
