# KomikRu Security Implementation

## Overview
Full-stack security implementation using Supabase Storage with original preservation, rate limiting, and audit logging.

## Features Implemented

### 1. Storage Infrastructure
- **Separate buckets for originals and derivatives:**
  - `covers` / `covers-originals` - Comic cover images
  - `chapters` / `chapters-originals` - Chapter page images
  - `ads` - Advertisement images/videos

- **Original Preservation:**
  - Originals stored in private buckets (admin-only access)
  - Derivatives stored in public buckets for web delivery
  - Original files preserve exact bytes uploaded (no re-encoding)

### 2. Secure Upload Flow
- **Edge Functions:**
  - `secure-upload-cover` - Cover image uploads
  - `secure-upload-chapter` - Chapter image uploads
  - All uploads go through server-side validation

- **Validation:**
  - File type validation (JPEG, PNG, WebP only)
  - File size limit: 20MB per file (configurable)
  - Admin role required for uploads
  - UUID-based filenames (prevents path traversal)

- **Signed URLs:**
  - Short-lived signed upload URLs (1 hour expiry)
  - Direct upload to storage buckets
  - Prevents unauthorized uploads

### 3. Rate Limiting
Implemented via `check_rate_limit()` database function:
- Cover uploads: 10/hour per user
- Chapter uploads: 50 images/hour per user
- Comments: 10/hour per user
- Automatic cleanup of old rate limit records

### 4. Comment Security
Implemented via `sanitize-comment` Edge Function:
- HTML tag removal
- Script injection prevention
- URL detection (blocked for accounts <7 days old)
- Spam pattern detection
- Character limit: 1-1000 characters
- Rate limiting

### 5. Audit Logging
All actions logged via `log_audit_event()` function:
- User ID and action
- Resource type and ID
- IP address and user agent
- Custom metadata per action
- Admin-only access to logs

### 6. Row Level Security (RLS)
**Storage Policies:**
- Public read access to derivative buckets
- Admin-only upload/delete on all buckets
- Admin-only read access to original buckets
- Path validation (UUID format required)

**Database Policies:**
- Admin-only: audit_logs (view)
- Server-only: rate_limits, admin_otp
- User-specific: comments, bookmarks, reading_history

### 7. Image Quality Preservation
- **Default behavior:**
  - Originals: Preserved byte-for-byte
  - Derivatives: Same format as original, no compression applied during upload
  
- **Future optimization options:**
  - Supabase Image Transformation API can be used for on-the-fly resizing
  - Quality parameter can be added to transformation URLs
  - WebP/AVIF derivatives can be generated via transformation API

## Configuration

### File Size Limits
Change in migration (storage buckets):
```sql
UPDATE storage.buckets 
SET file_size_limit = 52428800  -- 50MB in bytes
WHERE id IN ('covers', 'covers-originals', 'chapters', 'chapters-originals');
```

### Rate Limits
Modify in Edge Function code:
```typescript
// In secure-upload-cover/index.ts
const { data: canProceed } = await supabase.rpc('check_rate_limit', {
  _identifier: rateLimitIdentifier,
  _action: 'upload_cover',
  _max_requests: 20,  // Change this
  _window_minutes: 60
});
```

### Allowed File Types
Modify in Edge Function validation:
```typescript
const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
```

## Admin Operations

### View Audit Logs
```sql
SELECT * FROM audit_logs 
ORDER BY created_at DESC 
LIMIT 100;
```

### Download Original Files
Only admins can access originals via:
- Direct download from `covers-originals` or `chapters-originals` buckets
- Use Supabase Dashboard or client with admin credentials

### Clear Rate Limits (Emergency)
```sql
DELETE FROM rate_limits WHERE identifier = 'user-id';
```

## Security Recommendations

### 1. Password Protection
⚠️ **Action Required:** Enable leaked password protection in Lovable Cloud settings:
- Go to Lovable Cloud backend → Authentication → Password Security
- Enable "Leaked Password Protection"
- This prevents users from using compromised passwords

### 2. Email Verification (Optional for Production)
For production, enable email confirmation:
- Backend → Authentication → Email Confirmation
- Prevents spam account creation

### 3. Additional Rate Limiting (External)
For advanced DDoS protection, consider:
- Cloudflare free tier (rate limiting + bot protection)
- Cloudflare Turnstile for forms

### 4. Monitoring
Monitor audit logs for:
- Repeated failed admin logins
- Spam attempts (action: 'spam_detected')
- High upload volume from single user

## Testing

### 1. Upload Security Test
```bash
# Test 1: Upload without admin role (should fail)
# Test 2: Upload with invalid file type (should fail)
# Test 3: Upload file >20MB (should fail)
# Test 4: Valid admin upload (should succeed)
```

### 2. Rate Limit Test
```bash
# Test: Upload 11 covers in 1 hour (11th should fail with 429)
```

### 3. Comment Security Test
```bash
# Test 1: Post comment with HTML (should be stripped)
# Test 2: New user posts URL (should fail)
# Test 3: Post 11 comments in 1 hour (11th should fail)
```

### 4. Original Preservation Test
```bash
# Test: Upload image, download original, verify byte-for-byte match (checksum)
```

## Edge Functions Deployment
Edge Functions auto-deploy with your project. No manual deployment needed.

## Known Limitations

### No External Virus Scanning
- Supabase Storage doesn't support ClamAV integration
- Consider adding external service (e.g., VirusTotal API) if needed

### No Cloudflare R2 Integration
- Current implementation uses Supabase Storage
- Migration to Cloudflare R2 would require:
  - R2 bucket setup
  - R2 API keys
  - Edge Function modifications
  - DNS/CDN configuration

### Image Optimization
- Current: No automatic compression/optimization
- Derivatives are exact copies of originals
- Future: Add Supabase Image Transformation for on-demand resizing

## API Endpoints

### Upload Cover
```typescript
POST /functions/v1/secure-upload-cover
Authorization: Bearer <user-token>
Body: {
  komikId: string,
  fileName: string,
  fileType: string,
  fileSize: number
}
Returns: {
  originalUploadUrl: string,
  derivativeUploadUrl: string,
  expiresIn: number
}
```

### Upload Chapter Images
```typescript
POST /functions/v1/secure-upload-chapter
Authorization: Bearer <user-token>
Body: {
  komikId: string,
  chapterId: string,
  files: Array<{
    fileName: string,
    fileType: string,
    fileSize: number,
    index: number
  }>
}
```

### Post Comment (Sanitized)
```typescript
POST /functions/v1/sanitize-comment
Authorization: Bearer <user-token>
Body: {
  komikId: string,
  text: string
}
```

## Maintenance

### Weekly
- Review audit logs for suspicious activity
- Check rate_limits table size (auto-cleanup via function)

### Monthly
- Review storage usage
- Verify RLS policies are working
- Update file size limits if needed

### On Security Incident
1. Check audit_logs for attack patterns
2. Block offending IPs (add to rate_limits with high count)
3. Review recent uploads for malicious files
4. Rotate admin credentials if compromised
