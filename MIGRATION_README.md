# Cloudflare Images Migration Tool 🚀

This tool migrates images from the URLs in your `course_urls` SQL file to Cloudflare Images and updates your database with the new CDN URLs.

## Prerequisites

1. **Cloudflare Account**: You need a Cloudflare account with Images enabled
2. **Database Access**: MySQL/MariaDB database with the `course_urls` table
3. **Node.js**: Version 14 or higher

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit the `.env` file with your actual credentials:

```env
# Cloudflare Images API Configuration
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token

# Database Configuration
DB_HOST=your_database_host
DB_PORT=3306
DB_USER=your_database_username
DB_PASSWORD=your_database_password
DB_NAME=your_database_name

# Optional Configuration
DB_SSL=false
MAX_CONCURRENT_DOWNLOADS=5
MAX_CONCURRENT_UPLOADS=3
RETRY_ATTEMPTS=3
RETRY_DELAY=2000
```

### 3. Getting Cloudflare Credentials

#### Account ID:
1. Log in to your Cloudflare dashboard
2. Select your domain
3. Find your Account ID in the right sidebar under "API"

#### API Token:
1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use the "Custom token" template
4. Set permissions:
   - **Zone:Zone:Read** (for your domain)
   - **Account:Cloudflare Images:Edit**
5. Add Account Resources: Include your account
6. Click "Continue to summary" and "Create Token"

## Usage

### Run the Migration

```bash
# Using npm script
npm run migrate Course_Urls.sql

# Or directly with node
node cloudflare-migration.js Course_Urls.sql
```

## What It Does

The migration tool will:

1. **Parse SQL File**: Extract image URLs from the SQL file
2. **Download Images**: Download images from the following fields:
   - `image_url` (main course image)
   - `image_url_ar` (Arabic course image)
   - `preview_thumbnail_url` (video thumbnail)
3. **Upload to Cloudflare**: Upload each image to Cloudflare Images
4. **Backup & Update Database**: 
   - Move original URLs to backup fields (`image_url_backup`, `image_url_ar_backup`, `preview_thumbnail_url_backup`)
   - Replace main fields with new Cloudflare CDN URLs
5. **Progress Tracking**: Show real-time progress and statistics

## Features

- ✅ **Concurrent Processing**: Downloads and uploads run in parallel for speed
- 🔄 **Retry Logic**: Automatically retries failed downloads/uploads
- 📊 **Progress Tracking**: Real-time progress bar and statistics
- 🛡️ **Error Handling**: Continues processing even if some images fail
- 📝 **Detailed Logging**: Shows success/failure for each image
- 🎯 **Selective Updates**: Only updates fields that were successfully migrated

## Configuration Options

### Rate Limiting

You can adjust the concurrency and retry settings in your `.env` file:

```env
MAX_CONCURRENT_DOWNLOADS=5    # How many downloads at once
MAX_CONCURRENT_UPLOADS=3      # How many uploads at once
RETRY_ATTEMPTS=3              # How many times to retry failed operations
RETRY_DELAY=2000              # Delay between retries (milliseconds)
```

### Database SSL

For databases requiring SSL connections:

```env
DB_SSL=true
```

## Output Example

```
🚀 Starting Cloudflare Images Migration

✓ Configuration validated
✓ Connected to database
📁 Parsed 82 records from SQL file
Processing [████████████████████████████████████████] 82/82 100% 0.0s

🔄 Processing record ID: 8
  📥 Downloading image_url...
  ☁️  Uploading image_url to Cloudflare...
  ✓ image_url uploaded successfully
  📥 Downloading image_url_ar...
  ☁️  Uploading image_url_ar to Cloudflare...
  ✓ image_url_ar uploaded successfully
  ✓ Database updated for record 8

🏁 Migration Complete!
══════════════════════════════════════════════════════
📊 Total Records: 82
✅ Processed: 82
🎉 Successful: 78
❌ Failed: 3
⏭️  Skipped: 1
══════════════════════════════════════════════════════
```

## Database Schema

The tool expects a `course_urls` table with these columns:
- `id` - Primary key
- `image_url` - Main course image URL (will be updated with Cloudflare URL)
- `image_url_backup` - Backup for original main image URL
- `image_url_ar` - Arabic course image URL (will be updated with Cloudflare URL)
- `image_url_ar_backup` - Backup for original Arabic image URL
- `preview_thumbnail_url` - Video thumbnail URL (will be updated with Cloudflare URL)
- `preview_thumbnail_url_backup` - Backup for original thumbnail URL

The migration will:
1. Move original URLs to backup fields
2. Update main fields with new Cloudflare URLs

## Troubleshooting

### Common Issues

1. **"Missing required environment variables"**
   - Make sure all required variables are set in your `.env` file
   - Check for typos in variable names

2. **"Database connection failed"**
   - Verify database credentials
   - Check if database server is accessible
   - Ensure SSL settings are correct

3. **"Cloudflare upload failed"**
   - Verify your API token has the correct permissions
   - Check if you have sufficient Cloudflare Images quota
   - Ensure Account ID is correct

4. **"HTTP 404/403 errors"**
   - Some original image URLs may be broken or protected
   - The tool will skip these and continue with others

### Debug Mode

For more detailed logging, you can modify the script to add debug output or run with:

```bash
DEBUG=* node cloudflare-migration.js Course_Urls.sql
```

## File Structure

```
SpeedCompare/
├── .env                     # Your credentials (don't commit!)
├── .env.example            # Template for environment variables
├── cloudflare-migration.js # Main migration script
├── Course_Urls.sql         # Your SQL file with image URLs
├── MIGRATION_README.md     # This file
└── package.json           # Dependencies and scripts
```

## Security Notes

- Never commit your `.env` file to version control
- Use API tokens with minimal required permissions
- Consider using read-only database replicas for large migrations
- The script only updates the three image URL fields, leaving other data unchanged

## Performance Tips

- Run during off-peak hours to minimize impact
- Adjust concurrency limits based on your network and Cloudflare limits
- Consider processing in batches for very large datasets
- Monitor your Cloudflare Images quota during migration

## Need Help?

If you encounter issues:
1. Check the error messages in the console output
2. Verify your environment variables are correct
3. Test with a small subset of data first
4. Check Cloudflare API documentation for latest requirements 