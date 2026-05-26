---
name: file-storage
description: Secure file storage and delivery for Laravel SaaS using S3 or Cloudflare R2. Use when setting up S3 storage, configuring Cloudflare R2, implementing presigned URL uploads, adding virus scanning with ClamAV, configuring CDN delivery with CloudFront or Cloudflare, validating file uploads with magic bytes, generating signed URLs for private files, or isolating files per tenant. Also covers Storage::fake() testing, image variants with intervention/image, and EXIF stripping.
when_to_use: |
  - "file upload Laravel", "upload to S3", "upload to R2", "direct upload to storage"
  - "presigned URL", "temporary upload URL", "bypass server upload"
  - "virus scan files", "ClamAV Laravel", "scan before serving"
  - "signed CDN URL", "CloudFront signed URL", "private file delivery"
  - "multi-tenant file storage", "per-tenant bucket prefix"
  - "magic bytes validation", "file type validation beyond extension"
  - "Storage facade", "Storage::fake()", "test file uploads"
  - "intervention/image", "image variants", "thumbnail generation"
allowed-tools: Read Write Edit Bash Grep
---

# File Storage

Secure file storage and delivery for Laravel SaaS. Core rules — never deviate:

1. **Files never transit Laravel.** Client uploads directly to S3/R2 via presigned URL.
2. **All URLs are signed.** No public bucket ACLs, ever.
3. **Validate content, not extension.** Magic bytes + MIME check, always.
4. **Virus scan before serving.** File stays in `pending/` prefix until scan passes.

---

## 1. Driver setup

### Cloudflare R2 (preferred — zero egress fees)

```php
// config/filesystems.php
'r2' => [
    'driver'                  => 's3',
    'key'                     => env('R2_ACCESS_KEY_ID'),
    'secret'                  => env('R2_SECRET_ACCESS_KEY'),
    'region'                  => 'auto',
    'bucket'                  => env('R2_BUCKET'),
    'endpoint'                => env('R2_ENDPOINT'), // https://<account_id>.r2.cloudflarestorage.com
    'url'                     => env('R2_PUBLIC_URL'),
    'use_path_style_endpoint' => true,
    'throw'                   => true,
],
```

```bash
composer require league/flysystem-aws-s3-v3
```

### AWS S3

```php
's3' => [
    'driver' => 's3',
    'key'    => env('AWS_ACCESS_KEY_ID'),
    'secret' => env('AWS_SECRET_ACCESS_KEY'),
    'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    'bucket' => env('AWS_BUCKET'),
    'throw'  => true,
],
```

### Bucket hardening (both providers)

- Block all public access at the bucket/policy level — no exceptions.
- Enable SSE-S3 encryption at rest (SSE-KMS for regulated data).
- Enable versioning if deletion recovery is required.
- Set bucket CORS to allow `PUT` only from your app domain:

```json
[{
  "AllowedOrigins": ["https://yourapp.com"],
  "AllowedMethods": ["PUT"],
  "AllowedHeaders": ["Content-Type", "Content-Length"],
  "MaxAgeSeconds": 3600
}]
```

---

## 2. Presigned upload pattern (the only correct upload pattern)

Laravel issues a presigned URL; client uploads directly to S3/R2. Laravel never touches the bytes.

```php
// Generating the presigned PUT URL via AWS SDK (works for R2 and S3)
use Aws\S3\S3Client;

public function presign(Request $request): JsonResponse
{
    $request->validate([
        'filename'     => ['required', 'string', 'max:255'],
        'content_type' => ['required', new AllowedMimeType],
        'size'         => ['required', 'integer', 'max:' . (50 * 1024 * 1024)],
    ]);

    $key = 'uploads/pending/' . $request->user()->tenant_id
         . '/' . Str::uuid()
         . '/' . Str::slug(pathinfo($request->filename, PATHINFO_FILENAME));

    $client  = app(S3Client::class); // bind in AppServiceProvider
    $command = $client->getCommand('PutObject', [
        'Bucket'         => config('filesystems.disks.r2.bucket'),
        'Key'            => $key,
        'ContentType'    => $request->content_type,
        'ContentLength'  => $request->size,
    ]);

    $presignedUrl = (string) $client->createPresignedRequest($command, '+15 minutes')->getUri();

    $upload = PendingUpload::create([
        'key'          => $key,
        'tenant_id'    => $request->user()->tenant_id,
        'user_id'      => $request->user()->id,
        'content_type' => $request->content_type,
        'size'         => $request->size,
        'expires_at'   => now()->addMinutes(30),
    ]);

    return response()->json(['url' => $presignedUrl, 'upload_id' => $upload->id]);
}
```

**Confirm endpoint (called after client finishes PUT):**

```php
public function confirm(Request $request, PendingUpload $upload): JsonResponse
{
    abort_if($upload->tenant_id !== $request->user()->tenant_id, 403);
    abort_if($upload->confirmed_at !== null, 409, 'Already confirmed');
    abort_if($upload->expires_at->isPast(), 410, 'Upload expired');

    ScanUploadedFile::dispatch($upload);
    $upload->update(['confirmed_at' => now()]);

    return response()->json(['status' => 'scanning']);
}
```

---

## 3. File validation (three layers)

### Layer 1 — Laravel validation (traditional uploads only, not presigned flow)

```php
$request->validate([
    'file' => ['required', 'file', 'max:51200', 'mimes:pdf,jpg,jpeg,png,webp'],
]);
// 'mimes' uses PHP finfo (content-based), not just extension
```

### Layer 2 — Magic bytes (apply to all uploaded content post-receive)

```php
function validateMagicBytes(string $filePath, array $allowedTypes): string
{
    $bytes = file_get_contents($filePath, false, null, 0, 12);
    $hex   = bin2hex($bytes);

    $signatures = [
        'ffd8ff'   => 'jpeg',
        '89504e47' => 'png',
        '52494646' => 'webp',  // RIFF....WEBP
        '25504446' => 'pdf',   // %PDF
        '504b0304' => 'zip',   // ZIP (docx, xlsx, pptx)
    ];

    foreach ($signatures as $sig => $type) {
        if (str_starts_with($hex, $sig)) {
            if (!in_array($type, $allowedTypes)) {
                throw new \RuntimeException("File type '{$type}' not in allowed list");
            }
            return $type;
        }
    }

    throw new \RuntimeException('Unknown or disallowed file type');
}
```

### Layer 3 — AllowedMimeType rule (for presigned flow request validation)

```php
class AllowedMimeType implements Rule
{
    private const ALLOWED = [
        'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    public function passes($attribute, $value): bool
    {
        return in_array($value, self::ALLOWED, true);
    }

    public function message(): string { return 'File type not allowed.'; }
}
```

---

## 4. Virus scanning (async, post-upload)

File stays in `uploads/pending/` prefix until ClamAV clears it.

```php
// app/Jobs/ScanUploadedFile.php
class ScanUploadedFile implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries   = 1;   // fail fast — do not retry; quarantine instead
    public int $timeout = 120;

    public function __construct(public PendingUpload $upload) {}

    public function handle(): void
    {
        $tmpPath = tempnam(sys_get_temp_dir(), 'clamav_');

        try {
            // Stream from storage to temp — avoid loading full file into memory
            $stream = Storage::disk('r2')->readStream($this->upload->key);
            file_put_contents($tmpPath, $stream);
            fclose($stream);

            // ClamAV via socket — fail closed if socket unavailable
            $socket = stream_socket_client('unix:///var/run/clamav/clamd.ctl', $errno, $errstr, 5);
            if (!$socket) {
                throw new \RuntimeException("ClamAV unavailable: $errstr");
            }

            fwrite($socket, "SCAN {$tmpPath}\n");
            $response = fgets($socket);
            fclose($socket);

            if (str_contains($response, 'FOUND')) {
                Storage::disk('r2')->delete($this->upload->key);
                $this->upload->update(['status' => 'rejected', 'reject_reason' => 'virus_detected']);
                event(new FileRejected($this->upload));
                return;
            }

            // Promote: pending/ → files/
            $cleanKey = str_replace('uploads/pending/', 'files/', $this->upload->key);
            Storage::disk('r2')->copy($this->upload->key, $cleanKey);
            Storage::disk('r2')->delete($this->upload->key);
            $this->upload->update(['status' => 'ready', 'key' => $cleanKey]);
            event(new FileReady($this->upload));

        } finally {
            @unlink($tmpPath);
        }
    }

    public function failed(\Throwable $e): void
    {
        // Scanner failure = quarantine, NOT silent allow
        $this->upload->update(['status' => 'quarantined', 'reject_reason' => 'scan_failed']);
        Log::error('ClamAV scan failed — file quarantined', [
            'upload_id' => $this->upload->id,
            'error'     => $e->getMessage(),
        ]);
    }
}
```

Alternative packages: `sunspikes/clamav-validator`, `ikechukwukalu/clamavfileupload`.

---

## 5. CDN delivery and signed URLs

### Cloudflare (R2)

Connect R2 bucket to a Cloudflare zone via "Custom Domain" in R2 settings. Files served via Cloudflare's CDN automatically.

```php
// Signed temporary URL for private file access
$url = Storage::disk('r2')->temporaryUrl(
    $file->key,
    now()->addMinutes(60),
    ['ResponseContentDisposition' => 'inline; filename="' . $file->original_name . '"']
);
```

Cache-Control: set per file type in response headers:
- User documents: `Cache-Control: private, no-store`
- Public assets (logos, thumbnails): `Cache-Control: public, max-age=86400, s-maxage=604800`

### CloudFront (AWS S3)

```php
use Aws\CloudFront\CloudFrontClient;

$cf  = app(CloudFrontClient::class);
$url = $cf->getSignedUrl([
    'url'         => rtrim(env('CDN_URL'), '/') . '/' . $file->key,
    'expires'     => now()->addHour()->timestamp,
    'private_key' => storage_path('app/cloudfront/private.pem'),
    'key_pair_id' => env('CLOUDFRONT_KEY_PAIR_ID'),
]);
```

Store `private.pem` outside `public/`; add to `.gitignore`.

---

## 6. Image variants

```php
// composer require intervention/image-laravel
use Intervention\Image\ImageManager;
use Intervention\Image\Drivers\Gd\Driver;

class ProcessUploadedImage implements ShouldQueue
{
    public function handle(): void
    {
        $manager  = new ImageManager(new Driver());
        $tmpPath  = tempnam(sys_get_temp_dir(), 'img_');
        $stream   = Storage::disk('r2')->readStream($this->upload->key);
        file_put_contents($tmpPath, $stream);
        fclose($stream);

        $image = $manager->read($tmpPath);

        // Strip EXIF before storing (removes GPS coordinates, device info)
        // Intervention v3: encode as WebP removes EXIF by default

        $variants = ['thumbnail' => [150, 150], 'medium' => [800, 600]];

        foreach ($variants as $size => [$w, $h]) {
            $encoded   = $image->cover($w, $h)->toWebp(quality: 82);
            $variantKey = "files/{$this->upload->tenant_id}/{$size}/{$this->upload->id}.webp";
            Storage::disk('r2')->put($variantKey, $encoded->toString());
        }

        // Original: strip EXIF, re-encode as WebP
        $originalKey = "files/{$this->upload->tenant_id}/original/{$this->upload->id}.webp";
        Storage::disk('r2')->put($originalKey, $image->toWebp(quality: 90)->toString());

        $this->upload->update(['variants_processed_at' => now()]);
        @unlink($tmpPath);
    }
}
```

Always generate variants async (queue). Always strip EXIF (privacy). Store original as WebP to reduce size.

---

## 7. Multi-tenant isolation

```php
// Key pattern: {tenant_id}/{resource_type}/{upload_id}/{safe_filename}
private function buildKey(User $user, string $resourceType, string $uploadId, string $filename): string
{
    $safeFilename = Str::slug(pathinfo($filename, PATHINFO_FILENAME))
                  . '.' . strtolower(pathinfo($filename, PATHINFO_EXTENSION));

    return implode('/', [$user->tenant_id, $resourceType, $uploadId, $safeFilename]);
}

// When retrieving — ALWAYS assert tenant ownership before generating URL
public function download(Request $request, Upload $upload): JsonResponse
{
    abort_if($upload->tenant_id !== $request->user()->tenant_id, 403);

    return response()->json(['url' => Storage::disk('r2')->temporaryUrl($upload->key, now()->addMinutes(30))]);
}
```

- Use prefix-per-tenant (single bucket). Only use separate buckets when compliance mandates isolation (GDPR, HIPAA data residency).
- IAM policy: scope service credentials to `arn:aws:s3:::bucket/${tenant_id}/*` per tenant if using per-tenant API keys.

---

## 8. Testing

```php
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\UploadedFile;

it('stores uploaded file in pending prefix and dispatches scan', function () {
    Storage::fake('r2');
    Queue::fake();

    $response = $this->actingAs($this->user)
        ->postJson('/api/files', [
            'filename'     => 'report.pdf',
            'content_type' => 'application/pdf',
            'size'         => 1024,
        ]);

    $response->assertOk()->assertJsonStructure(['url', 'upload_id']);
    Queue::assertNothingPushed(); // scan dispatched only on confirm
});

it('dispatches virus scan on confirm', function () {
    Storage::fake('r2');
    Queue::fake();

    $upload = PendingUpload::factory()->for($this->user)->create();
    Storage::disk('r2')->put($upload->key, 'fake content');

    $this->actingAs($this->user)
        ->postJson("/api/files/{$upload->id}/confirm")
        ->assertOk();

    Queue::assertPushed(ScanUploadedFile::class, fn($job) => $job->upload->is($upload));
});

it('rejects file with disallowed magic bytes', function () {
    // PHP exe header disguised as PDF
    expect(fn() => validateMagicBytes(
        createTempFileWithBytes("\x4D\x5A\x90\x00"), // MZ header (Windows PE)
        ['jpeg', 'png', 'pdf']
    ))->toThrow(\RuntimeException::class, 'Unknown or disallowed file type');
});

it('blocks access to file from different tenant', function () {
    $upload = Upload::factory()->create(['tenant_id' => 'other-tenant']);

    $this->actingAs($this->user)
        ->getJson("/api/files/{$upload->id}/download")
        ->assertForbidden();
});
```

---

## 9. Security checklist

Deploy gate — all items required before production:

- [ ] Bucket public access blocked at provider level (not just ACL)
- [ ] CORS restricted to `PUT` from your app domain only
- [ ] All URLs signed; no direct public object URLs anywhere in codebase
- [ ] URL expiry ≤ 60 min for user documents; ≤ 15 min for upload presigned URLs
- [ ] Magic bytes validation on every received file (not just Laravel `mimes:`)
- [ ] ClamAV running and accessible; scan failure = quarantine (never silent allow)
- [ ] `pending/` prefix files that are not confirmed within 30 min are deleted by a scheduled job
- [ ] Tenant prefix in every storage key; ownership asserted before every URL generation
- [ ] EXIF stripped from all images before storing final variant
- [ ] Filenames sanitised through `Str::slug()` + UUID; raw user input never in storage key
- [ ] `private.pem` (CloudFront) is outside `public/`, in `.gitignore`, loaded from `storage_path()`
