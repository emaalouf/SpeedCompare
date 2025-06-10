# 🚀 Quick Start Guide

## ✅ Setup Complete!

Your Cloudflare Images migration tool is now ready. Here's what you need to do:

## 1. Configure Your Credentials

Edit the `.env` file with your actual credentials:

```bash
# Open the .env file and fill in your credentials
nano .env
```

Required values:
- `CLOUDFLARE_ACCOUNT_ID` - From your Cloudflare dashboard
- `CLOUDFLARE_API_TOKEN` - Create one with Images:Edit permissions
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - Your database credentials

## 2. Test Your Configuration

Before running the migration, test that everything is set up correctly:

```bash
npm run test-config
```

This will verify:
- ✓ Environment variables are set
- ✓ Database connection works
- ✓ Cloudflare API is accessible
- ✓ course_urls table exists

## 3. Run the Migration

Once the test passes, run the migration:

```bash
npm run migrate Course_Urls.sql
```

## 🎯 What This Does

The migration will:

1. **Parse** your `Course_Urls.sql` file (82 records found)
2. **Download** images from:
   - `image_url` (main course images)
   - `image_url_ar` (Arabic course images) 
   - `preview_thumbnail_url` (video thumbnails)
3. **Upload** them to Cloudflare Images
4. **Update** your database with new CDN URLs

## 📊 Expected Output

```
🚀 Starting Cloudflare Images Migration

✓ Configuration validated
✓ Connected to database
📁 Parsed 82 records from SQL file
Processing [████████████████████████] 82/82 100% 

🏁 Migration Complete!
📊 Total Records: 82
🎉 Successful: 78
❌ Failed: 3
⏭️ Skipped: 1
```

## 🛡️ Safety Features

- **Non-destructive**: Only updates the 3 image URL fields
- **Resilient**: Continues even if some images fail
- **Retries**: Automatically retries failed downloads/uploads
- **Progress tracking**: Real-time status updates

## 🆘 Need Help?

1. **Configuration issues**: Run `npm run test-config`
2. **Migration problems**: Check the detailed output for error messages
3. **Documentation**: See `MIGRATION_README.md` for full details

## 📁 Files Overview

- `Course_Urls.sql` - Your data file (82 records)
- `cloudflare-migration.js` - Main migration script
- `test-config.js` - Configuration tester
- `.env` - Your credentials (keep private!)
- `MIGRATION_README.md` - Detailed documentation

---

**Ready to migrate? Start with `npm run test-config`** 🚀 