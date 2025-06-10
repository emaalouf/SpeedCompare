#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const chalk = require('chalk');
const ProgressBar = require('progress');
const mysql = require('mysql2/promise');
const FormData = require('form-data');
const pLimit = require('p-limit');

class CloudflareImageMigrator {
  constructor() {
    this.config = {
      cloudflare: {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
        apiToken: process.env.CLOUDFLARE_API_TOKEN,
        apiUrl: process.env.CLOUDFLARE_IMAGES_API_URL?.replace('{account_id}', process.env.CLOUDFLARE_ACCOUNT_ID)
      },
      database: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === 'true'
      },
      limits: {
        downloads: parseInt(process.env.MAX_CONCURRENT_DOWNLOADS) || 5,
        uploads: parseInt(process.env.MAX_CONCURRENT_UPLOADS) || 3,
        retryAttempts: parseInt(process.env.RETRY_ATTEMPTS) || 3,
        retryDelay: parseInt(process.env.RETRY_DELAY) || 2000
      }
    };

    this.downloadLimit = pLimit(this.config.limits.downloads);
    this.uploadLimit = pLimit(this.config.limits.uploads);
    this.dbConnection = null;
    this.stats = {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0
    };
  }

  validateConfig() {
    const required = [
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_API_TOKEN',
      'DB_HOST',
      'DB_USER',
      'DB_PASSWORD',
      'DB_NAME'
    ];

    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  async connectToDatabase() {
    try {
      this.dbConnection = await mysql.createConnection(this.config.database);
      console.log(chalk.green('✓ Connected to database'));
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  async parseSqlFile(filePath) {
    try {
      const sqlContent = await fs.readFile(filePath, 'utf8');
      const records = [];
      
      // Find the INSERT statement for course_urls (handle multi-line)
      const insertMatch = sqlContent.match(/INSERT INTO `course_urls`[^;]*VALUES\s*([\s\S]*?);/i);
      
      if (!insertMatch) {
        throw new Error('No INSERT statement found for course_urls table');
      }

      const valuesSection = insertMatch[1];
      
      // Parse individual record rows - handle multi-line and nested parentheses
      const rows = this.extractRows(valuesSection);
      
      rows.forEach(row => {
        const values = this.parseValues(row);
        if (values && values.length >= 12) {
          records.push({
            id: values[0],
            course_id: values[1],
            image_url: values[2],
            image_url_backup: values[3],
            image_url_ar: values[4],
            image_url_ar_backup: values[5],
            downloadable_url: values[6],
            preview_temp_file: values[7],
            preview_video_id: values[8],
            preview_url: values[9],
            preview_thumbnail_url: values[10],
            preview_thumbnail_url_backup: values[11]
          });
        }
      });

      console.log(chalk.blue(`📁 Parsed ${records.length} records from SQL file`));
      return records;
    } catch (error) {
      throw new Error(`Failed to parse SQL file: ${error.message}`);
    }
  }

  extractRows(valuesSection) {
    const rows = [];
    let currentRow = '';
    let depth = 0;
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < valuesSection.length; i++) {
      const char = valuesSection[i];
      
      if (!inQuotes && (char === "'" || char === '"')) {
        inQuotes = true;
        quoteChar = char;
        currentRow += char;
      } else if (inQuotes && char === quoteChar) {
        // Check if it's an escaped quote
        if (valuesSection[i + 1] === quoteChar) {
          currentRow += char + char;
          i++; // Skip next character
        } else {
          inQuotes = false;
          quoteChar = '';
          currentRow += char;
        }
      } else if (!inQuotes && char === '(') {
        depth++;
        currentRow += char;
      } else if (!inQuotes && char === ')') {
        depth--;
        currentRow += char;
        
        // If we've closed the outermost parentheses, we have a complete row
        if (depth === 0 && currentRow.trim().startsWith('(')) {
          rows.push(currentRow.trim());
          currentRow = '';
        }
      } else if (!inQuotes && char === ',' && depth === 0) {
        // Skip commas between rows
        continue;
      } else {
        currentRow += char;
      }
    }
    
    // Add any remaining row
    if (currentRow.trim() && currentRow.trim().startsWith('(')) {
      rows.push(currentRow.trim());
    }
    
    return rows;
  }

  parseValues(valuesString) {
    // Remove parentheses and split by comma, handling quoted strings
    const cleaned = valuesString.slice(1, -1); // Remove outer parentheses
    const values = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      
      if (!inQuotes && (char === "'" || char === '"')) {
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar) {
        // Check if it's an escaped quote
        if (cleaned[i + 1] === quoteChar) {
          current += char;
          i++; // Skip next character
        } else {
          inQuotes = false;
          quoteChar = '';
        }
      } else if (!inQuotes && char === ',') {
        values.push(current.trim() === 'NULL' ? null : current.trim().replace(/^['"]|['"]$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add the last value
    if (current) {
      values.push(current.trim() === 'NULL' ? null : current.trim().replace(/^['"]|['"]$/g, ''));
    }
    
    return values;
  }

  async downloadImage(url, retries = 0) {
    return new Promise((resolve, reject) => {
      if (!url || url === 'NULL') {
        return resolve(null);
      }

      try {
        const parsedUrl = new URL(url);
        const client = parsedUrl.protocol === 'https:' ? https : http;

        const request = client.get(url, (response) => {
          // Handle redirects
          if (response.statusCode === 301 || response.statusCode === 302) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              console.log(chalk.gray(`    Following redirect to: ${redirectUrl}`));
              return this.downloadImage(redirectUrl, retries).then(resolve).catch(reject);
            }
          }
          
          if (response.statusCode !== 200) {
            return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          }

          const chunks = [];
          response.on('data', chunk => chunks.push(chunk));
          response.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const contentType = response.headers['content-type'] || 'image/jpeg';
            resolve({ buffer, contentType, url });
          });
          response.on('error', reject);
        });

        request.on('error', (error) => {
          if (retries < this.config.limits.retryAttempts) {
            setTimeout(() => {
              this.downloadImage(url, retries + 1).then(resolve).catch(reject);
            }, this.config.limits.retryDelay);
          } else {
            reject(error);
          }
        });

        request.setTimeout(30000, () => {
          request.destroy();
          reject(new Error('Download timeout'));
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  async uploadToCloudflare(imageData, fileName) {
    return new Promise((resolve, reject) => {
      if (!imageData) return resolve(null);

      const formData = new FormData();
      formData.append('file', imageData.buffer, {
        filename: fileName,
        contentType: imageData.contentType
      });

      const options = {
        method: 'POST',
        hostname: 'api.cloudflare.com',
        path: `/client/v4/accounts/${this.config.cloudflare.accountId}/images/v1`,
        headers: {
          'Authorization': `Bearer ${this.config.cloudflare.apiToken}`,
          ...formData.getHeaders()
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.success) {
              resolve(response.result.variants[0]); // Return the CDN URL
            } else {
              reject(new Error(`Cloudflare upload failed: ${response.errors?.[0]?.message || 'Unknown error'}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse Cloudflare response: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      formData.pipe(req);
    });
  }

  generateFileName(originalUrl, recordId, type) {
    const extension = path.extname(new URL(originalUrl).pathname) || '.jpg';
    return `course_${recordId}_${type}_${Date.now()}${extension}`;
  }

  async processRecord(record) {
    const updates = {};
    const urlFields = [
      { field: 'image_url', backupField: 'image_url_backup', type: 'main' },
      { field: 'image_url_ar', backupField: 'image_url_ar_backup', type: 'ar' },
      { field: 'preview_thumbnail_url', backupField: 'preview_thumbnail_url_backup', type: 'thumb' }
    ];

    console.log(chalk.yellow(`\n🔄 Processing record ID: ${record.id}`));

    for (const { field, backupField, type } of urlFields) {
      const originalUrl = record[field];
      if (!originalUrl || originalUrl === 'NULL') {
        console.log(chalk.gray(`  ⏭️  Skipping ${field} (no URL)`));
        continue;
      }

      try {
        console.log(chalk.blue(`  📥 Downloading ${field}...`));
        const imageData = await this.downloadLimit(() => this.downloadImage(originalUrl));
        
        if (imageData) {
          console.log(chalk.blue(`  ☁️  Uploading ${field} to Cloudflare...`));
          const fileName = this.generateFileName(originalUrl, record.id, type);
          const cloudflareUrl = await this.uploadLimit(() => this.uploadToCloudflare(imageData, fileName));
          
          if (cloudflareUrl) {
            // Move original URL to backup field and set new Cloudflare URL
            updates[backupField] = originalUrl;
            updates[field] = cloudflareUrl;
            console.log(chalk.green(`  ✓ ${field} uploaded successfully`));
            console.log(chalk.gray(`    📦 Original URL backed up to ${backupField}`));
          }
        }
      } catch (error) {
        console.log(chalk.red(`  ✗ Failed to process ${field}: ${error.message}`));
        this.stats.failed++;
      }
    }

    // Update database if we have any successful uploads
    if (Object.keys(updates).length > 0) {
      try {
        await this.updateDatabase(record.id, updates);
        console.log(chalk.green(`  ✓ Database updated for record ${record.id}`));
        this.stats.successful++;
      } catch (error) {
        console.log(chalk.red(`  ✗ Failed to update database for record ${record.id}: ${error.message}`));
        this.stats.failed++;
      }
    } else {
      console.log(chalk.yellow(`  ⚠️  No updates for record ${record.id}`));
      this.stats.skipped++;
    }

    this.stats.processed++;
  }

  async updateDatabase(recordId, updates) {
    const setClause = Object.keys(updates)
      .map(field => `${field} = ?`)
      .join(', ');
    
    const values = Object.values(updates);
    values.push(recordId);

    const query = `UPDATE course_urls SET ${setClause} WHERE id = ?`;
    await this.dbConnection.execute(query, values);
  }

  async migrate(sqlFilePath) {
    try {
      console.log(chalk.magenta('🚀 Starting Cloudflare Images Migration\n'));

      // Validate configuration
      this.validateConfig();
      console.log(chalk.green('✓ Configuration validated'));

      // Connect to database
      await this.connectToDatabase();

      // Parse SQL file
      const records = await this.parseSqlFile(sqlFilePath);
      this.stats.total = records.length;

      // Create progress bar
      const progressBar = new ProgressBar(
        'Processing [:bar] :current/:total :percent :etas', 
        {
          complete: '█',
          incomplete: '░',
          width: 40,
          total: records.length
        }
      );

      // Process records
      for (const record of records) {
        await this.processRecord(record);
        progressBar.tick();
      }

      // Print final statistics
      this.printStats();

    } catch (error) {
      console.error(chalk.red(`\n❌ Migration failed: ${error.message}`));
      throw error;
    } finally {
      if (this.dbConnection) {
        await this.dbConnection.end();
        console.log(chalk.gray('\n🔌 Database connection closed'));
      }
    }
  }

  printStats() {
    console.log(chalk.green('\n🏁 Migration Complete!'));
    console.log('═'.repeat(50));
    console.log(`📊 Total Records: ${chalk.cyan(this.stats.total)}`);
    console.log(`✅ Processed: ${chalk.green(this.stats.processed)}`);
    console.log(`🎉 Successful: ${chalk.green(this.stats.successful)}`);
    console.log(`❌ Failed: ${chalk.red(this.stats.failed)}`);
    console.log(`⏭️  Skipped: ${chalk.yellow(this.stats.skipped)}`);
    console.log('═'.repeat(50));
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log(chalk.yellow('Usage: node cloudflare-migration.js <sql_file_path>'));
    console.log(chalk.gray('Example: node cloudflare-migration.js Course_Urls.sql'));
    process.exit(1);
  }

  const sqlFilePath = args[0];
  
  // Check if SQL file exists
  try {
    await fs.access(sqlFilePath);
  } catch (error) {
    console.error(chalk.red(`❌ SQL file not found: ${sqlFilePath}`));
    process.exit(1);
  }

  const migrator = new CloudflareImageMigrator();

  try {
    await migrator.migrate(sqlFilePath);
  } catch (error) {
    console.error(chalk.red('Migration failed:'), error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = CloudflareImageMigrator; 