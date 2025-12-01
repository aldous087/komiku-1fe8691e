# 📦 CBZ Upload Module - Complete Guide

## Overview

The CBZ Upload module provides automated processing of Comic Book Archive (.cbz) files with intelligent metadata detection, image compression, and seamless integration with Cloudflare R2 storage.

## 🎯 Key Features

### 1. **Auto-Detection**
- ✅ Detects comic title from folder/file name if ComicInfo.xml is missing
- ✅ Extracts chapter number from filename patterns:
  - `Chapter 285.cbz` → Chapter 285
  - `ch285.cbz` → Chapter 285
  - `285.cbz` → Chapter 285
- ✅ Detects total pages automatically
- ✅ Recognizes multiple image formats (.jpg, .jpeg, .png, .webp)

### 2. **ComicInfo.xml Parsing**
Automatically extracts metadata when available:
- Title
- Series name
- Chapter number
- Summary/Description
- Tags
- Genres
- Writer
- Penciller (Artist)
- Alternative titles
- Page count

### 3. **Auto-Create Comics**
If comic doesn't exist in database:
- Creates new comic entry automatically
- Uses metadata from XML (Series, Summary, Genres)
- Sets cover image from first page
- Generates unique slug

### 4. **Image Processing**
- Sorts images numerically (1, 2, 3... not 1, 10, 11, 2...)
- Maintains correct page order
- Supports multiple formats (JPG, PNG, WEBP)

### 5. **Cloudflare R2 Upload**
Uploads to organized structure:
```
comics/{comic_id}/chapters/{chapter_number}/
├── 1.jpg
├── 2.jpg
├── 3.jpg
├── ...
└── info.html
```

### 6. **Auto-Generate info.html**
Creates HTML info page containing:
- Chapter title
- Series name
- Summary
- Genres and tags
- Alternative titles
- Writer and artist info
- Total pages
- Upload timestamp

### 7. **Database Integration**
Updates `chapters` table with:
- `comic_id` - Comic reference
- `chapter_number` - Chapter number
- `title` - Chapter title
- `summary` - Chapter description
- `total_pages` - Total page count
- `r2_base_path` - R2 storage path
- `html_info_url` - URL to info.html
- `cover_page_url` - URL to page 1 (cover)
- `metadata` - Full parsed metadata as JSONB

### 8. **Upload Logging**
Tracks all uploads in `cbz_upload_logs` table:
- Original filename
- Total pages processed
- Status (SUCCESS/FAILED)
- Error messages (if any)
- Full metadata
- Timestamps

## 🚀 How to Use

### Access the Upload Page

1. Login to Admin Panel: `/admin-login`
2. Navigate to **Upload CBZ** from sidebar
3. Or go directly to: `/admin/cbz-upload`

### Upload Process

#### Step 1: Select Comic (Optional)
- Choose existing comic from dropdown
- OR leave empty to auto-create from metadata

#### Step 2: Set Chapter Number (Optional)
- Enter specific chapter number
- OR leave empty to auto-detect from filename/XML

#### Step 3: Select CBZ File
- Click "Choose file"
- Select your .cbz file
- File size and name will be displayed

#### Step 4: Upload & Process
- Click "Upload & Process CBZ"
- Wait for processing (time varies by file size)
- View results when complete

### Result Display

After successful upload, you'll see:
- ✅ Chapter number
- ✅ Total pages processed
- ✅ Parsed metadata (series, title, genres)
- ✅ Links to view comic and info.html
- ✅ Raw JSON data (for debugging)

## 📝 ComicInfo.xml Format

The module supports standard ComicInfo.xml format:

```xml
<?xml version="1.0"?>
<ComicInfo>
  <Title>Chapter Title</Title>
  <Series>Series Name</Series>
  <Number>285</Number>
  <Summary>Chapter description here...</Summary>
  <Genre>Action, Fantasy, Adventure</Genre>
  <Tags>Martial Arts, Cultivation</Tags>
  <Writer>Author Name</Writer>
  <Penciller>Artist Name</Penciller>
  <PageCount>42</PageCount>
  <AlternateSeries>Alternative Name</AlternateSeries>
</ComicInfo>
```

## 🔧 Technical Details

### Backend Architecture

**Edge Function**: `upload-cbz`
- Location: `supabase/functions/upload-cbz/index.ts`
- Uses `fflate` for CBZ extraction
- Processes images in memory
- Uploads to R2 asynchronously

### Database Schema

**chapters table** - Extended with CBZ fields:
```sql
summary TEXT,
total_pages INTEGER,
r2_base_path TEXT,
html_info_url TEXT,
cover_page_url TEXT,
metadata JSONB
```

**cbz_upload_logs table** - New tracking table:
```sql
id UUID PRIMARY KEY,
comic_id UUID REFERENCES komik(id),
chapter_id UUID REFERENCES chapters(id),
original_filename TEXT,
total_pages INTEGER,
status TEXT,
error_message TEXT,
metadata JSONB,
created_at TIMESTAMPTZ,
updated_at TIMESTAMPTZ
```

### Image Sorting Algorithm

Uses numeric sorting to prevent incorrect ordering:
```javascript
files.sort((a, b) => {
  const numA = parseInt(a[0].match(/(\d+)/)?.[1] || '0', 10);
  const numB = parseInt(b[0].match(/(\d+)/)?.[1] || '0', 10);
  return numA - numB;
});
```

## 🎨 Frontend Components

**AdminCbzUpload.tsx** - Main upload interface:
- Comic selection dropdown
- Chapter number input
- File upload with validation
- Real-time result display
- Metadata viewer
- Debug accordion with raw JSON

## 🔒 Security

### Authentication Required
- Admin role required for access
- JWT token verification
- Row Level Security (RLS) on all tables

### Upload Validation
- File type checking (.cbz only)
- Size validation
- MIME type verification
- Malicious file prevention

## ⚠️ Important Rules

1. **No Re-uploads**: System checks if files exist before uploading
2. **No Duplicates**: Prevents creating duplicate comics
3. **Numeric Sorting**: Images always sorted numerically
4. **Page 1 = Cover**: First page automatically becomes chapter cover
5. **Robust XML Parsing**: Handles missing or invalid XML gracefully

## 🐛 Troubleshooting

### Upload Fails
- Check file is valid .cbz format
- Verify file isn't corrupted
- Ensure R2 credentials are configured
- Check edge function logs

### Metadata Not Detected
- Verify ComicInfo.xml exists in CBZ root
- Check XML format is valid
- System will auto-detect from filename if XML missing

### Images Out of Order
- Check image filenames have numbers
- System uses numeric sorting automatically
- Manually verify file order in CBZ

### Comic Not Created
- Verify series name in metadata
- Check for duplicate comics
- Ensure admin permissions

## 📊 Monitoring

### Check Upload Logs
Query `cbz_upload_logs` table:
```sql
SELECT * FROM cbz_upload_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

### View Failed Uploads
```sql
SELECT * FROM cbz_upload_logs 
WHERE status = 'FAILED'
ORDER BY created_at DESC;
```

### Count Total Uploads
```sql
SELECT 
  COUNT(*) as total,
  SUM(total_pages) as total_pages_processed
FROM cbz_upload_logs
WHERE status = 'SUCCESS';
```

## 🚀 Future Enhancements

Potential improvements:
- [ ] Batch upload multiple CBZ files
- [ ] Progress bar for large files
- [ ] Image compression to WebP
- [ ] Thumbnail generation
- [ ] ZIP format support
- [ ] Async processing for very large files
- [ ] Email notification on completion

## 📚 Related Documentation

- [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) - Complete setup guide
- [SCRAPER_SYSTEM.md](SCRAPER_SYSTEM.md) - Scraper documentation
- [migration-complete.sql](migration-complete.sql) - Database schema

## 💡 Tips

- **Naming Convention**: Use consistent filename format like `Series Name - Chapter 123.cbz`
- **Metadata**: Include ComicInfo.xml for best results
- **Organization**: Sort files numerically before creating CBZ
- **Testing**: Try with small CBZ files first
- **Backup**: Keep original CBZ files as backup

## 🤝 Support

For issues or questions:
1. Check edge function logs: `/admin` → Logs
2. Review `cbz_upload_logs` table
3. Verify R2 configuration
4. Check Supabase dashboard for errors

---

**Built with KomikRu** - Powered by Supabase + Cloudflare R2
