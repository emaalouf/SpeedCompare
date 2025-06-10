#!/usr/bin/env node

require('dotenv').config();
const mysql = require('mysql2/promise');
const https = require('https');
const chalk = require('chalk');

class ConfigTester {
  constructor() {
    this.config = {
      cloudflare: {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
        apiToken: process.env.CLOUDFLARE_API_TOKEN
      },
      database: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === 'true'
      }
    };
  }

  async testDatabaseConnection() {
    console.log(chalk.blue('🔍 Testing database connection...'));
    
    try {
      const connection = await mysql.createConnection(this.config.database);
      
      // Test basic connection
      await connection.execute('SELECT 1');
      console.log(chalk.green('✓ Database connection successful'));
      
      // Test if course_urls table exists
      try {
        const [rows] = await connection.execute('SELECT COUNT(*) as count FROM course_urls');
        console.log(chalk.green(`✓ Found course_urls table with ${rows[0].count} records`));
      } catch (error) {
        console.log(chalk.red('✗ course_urls table not found or inaccessible'));
        console.log(chalk.gray(`  Error: ${error.message}`));
      }
      
      await connection.end();
    } catch (error) {
      console.log(chalk.red('✗ Database connection failed'));
      console.log(chalk.gray(`  Error: ${error.message}`));
    }
  }

  async testCloudflareAPI() {
    console.log(chalk.blue('🔍 Testing Cloudflare API connection...'));
    
    if (!this.config.cloudflare.accountId || !this.config.cloudflare.apiToken) {
      console.log(chalk.red('✗ Missing Cloudflare credentials'));
      return;
    }

    return new Promise((resolve) => {
      const options = {
        hostname: 'api.cloudflare.com',
        path: `/client/v4/accounts/${this.config.cloudflare.accountId}/images/v1/stats`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.cloudflare.apiToken}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.success) {
              console.log(chalk.green('✓ Cloudflare API connection successful'));
              console.log(chalk.green(`✓ Images usage: ${response.result.count.current}/${response.result.count.allowed || 'unlimited'}`));
            } else {
              console.log(chalk.red('✗ Cloudflare API authentication failed'));
              console.log(chalk.gray(`  Error: ${response.errors?.[0]?.message || 'Unknown error'}`));
            }
          } catch (error) {
            console.log(chalk.red('✗ Failed to parse Cloudflare response'));
            console.log(chalk.gray(`  Error: ${error.message}`));
          }
          resolve();
        });
      });

      req.on('error', (error) => {
        console.log(chalk.red('✗ Cloudflare API request failed'));
        console.log(chalk.gray(`  Error: ${error.message}`));
        resolve();
      });

      req.end();
    });
  }

  testEnvironmentVariables() {
    console.log(chalk.blue('🔍 Checking environment variables...'));
    
    const required = [
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_API_TOKEN',
      'DB_HOST',
      'DB_USER',
      'DB_PASSWORD',
      'DB_NAME'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length === 0) {
      console.log(chalk.green('✓ All required environment variables are set'));
    } else {
      console.log(chalk.red('✗ Missing required environment variables:'));
      missing.forEach(key => {
        console.log(chalk.red(`  - ${key}`));
      });
    }

    // Show optional variables
    const optional = [
      'DB_PORT',
      'DB_SSL',
      'MAX_CONCURRENT_DOWNLOADS',
      'MAX_CONCURRENT_UPLOADS',
      'RETRY_ATTEMPTS',
      'RETRY_DELAY'
    ];

    console.log(chalk.gray('\nOptional configuration:'));
    optional.forEach(key => {
      const value = process.env[key];
      if (value) {
        console.log(chalk.gray(`  ${key}: ${value}`));
      } else {
        console.log(chalk.gray(`  ${key}: (using default)`));
      }
    });
  }

  async runTests() {
    console.log(chalk.magenta('🧪 Configuration Test Suite\n'));

    this.testEnvironmentVariables();
    console.log('');
    
    await this.testDatabaseConnection();
    console.log('');
    
    await this.testCloudflareAPI();
    
    console.log(chalk.magenta('\n📋 Test Summary'));
    console.log('If all tests pass, you\'re ready to run the migration!');
    console.log(chalk.gray('Usage: npm run migrate Course_Urls.sql'));
  }
}

if (require.main === module) {
  const tester = new ConfigTester();
  tester.runTests().catch(error => {
    console.error(chalk.red('Test suite failed:'), error.message);
    process.exit(1);
  });
}

module.exports = ConfigTester; 