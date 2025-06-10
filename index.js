#!/usr/bin/env node

const https = require('https');
const http = require('http');
const { URL } = require('url');
const chalk = require('chalk');
const ProgressBar = require('progress');

class SpeedTester {
  constructor() {
    this.results = [];
  }

  async downloadFile(url, label) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let totalBytes = 0;
      let contentLength = 0;

      try {
        const parsedUrl = new URL(url);
        const client = parsedUrl.protocol === 'https:' ? https : http;

        console.log(chalk.blue(`\n📡 Starting download from ${label}: ${url}`));

        const request = client.get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            return;
          }

          contentLength = parseInt(response.headers['content-length']) || 0;
          
          let progressBar;
          if (contentLength > 0) {
            progressBar = new ProgressBar(
              `${chalk.cyan(label)} [:bar] :percent :etas :rate bps`, 
              {
                complete: '█',
                incomplete: '░',
                width: 30,
                total: contentLength
              }
            );
          }

          response.on('data', (chunk) => {
            totalBytes += chunk.length;
            if (progressBar) {
              progressBar.tick(chunk.length);
            }
          });

          response.on('end', () => {
            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000; // Convert to seconds
            const speed = totalBytes / duration; // Bytes per second

            resolve({
              url,
              label,
              totalBytes,
              duration,
              speed,
              contentLength
            });
          });

          response.on('error', reject);
        });

        request.on('error', reject);
        request.setTimeout(30000, () => {
          request.destroy();
          reject(new Error('Request timeout'));
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatSpeed(bytesPerSecond) {
    return this.formatBytes(bytesPerSecond) + '/s';
  }

  displayResults(results) {
    console.log(chalk.green('\n🏁 Download Results:'));
    console.log('═'.repeat(80));

    results.forEach((result, index) => {
      console.log(chalk.yellow(`\n${result.label} (${result.url}):`));
      console.log(`  📦 File Size: ${this.formatBytes(result.totalBytes)}`);
      console.log(`  ⏱️  Duration: ${result.duration.toFixed(2)} seconds`);
      console.log(`  🚀 Speed: ${chalk.cyan(this.formatSpeed(result.speed))}`);
    });

    if (results.length === 2) {
      console.log(chalk.green('\n📊 Comparison:'));
      console.log('─'.repeat(40));
      
      const [result1, result2] = results;
      const speedDiff = Math.abs(result1.speed - result2.speed);
      const speedDiffPercent = ((speedDiff / Math.min(result1.speed, result2.speed)) * 100).toFixed(1);
      
      if (result1.speed > result2.speed) {
        console.log(`${chalk.green('🏆 Winner:')} ${result1.label}`);
        console.log(`${chalk.cyan('Speed advantage:')} ${this.formatSpeed(speedDiff)} (${speedDiffPercent}% faster)`);
      } else if (result2.speed > result1.speed) {
        console.log(`${chalk.green('🏆 Winner:')} ${result2.label}`);
        console.log(`${chalk.cyan('Speed advantage:')} ${this.formatSpeed(speedDiff)} (${speedDiffPercent}% faster)`);
      } else {
        console.log(chalk.yellow('🤝 It\'s a tie!'));
      }
    }

    console.log('\n' + '═'.repeat(80));
  }

  async compareUrls(url1, url2) {
    try {
      console.log(chalk.magenta('🚀 SpeedCompare - URL Download Speed Comparison Tool\n'));

      const results = await Promise.all([
        this.downloadFile(url1, 'URL 1'),
        this.downloadFile(url2, 'URL 2')
      ]);

      this.displayResults(results);
      return results;

    } catch (error) {
      console.error(chalk.red('❌ Error during comparison:'), error.message);
      throw error;
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(chalk.yellow('Usage: node index.js <url1> <url2>'));
    console.log(chalk.gray('Example: node index.js https://example.com/file1.zip https://example.com/file2.zip'));
    process.exit(1);
  }

  const [url1, url2] = args;
  const tester = new SpeedTester();

  try {
    await tester.compareUrls(url1, url2);
  } catch (error) {
    console.error(chalk.red('Failed to complete speed comparison:'), error.message);
    process.exit(1);
  }
}

// Interactive mode if no arguments provided
if (require.main === module) {
  main();
}

module.exports = SpeedTester; 