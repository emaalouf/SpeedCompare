const SpeedTester = require('./index.js');

async function runExample() {
  const tester = new SpeedTester();
  
  // Example URLs - you can replace these with any file URLs
  const url1 = 'https://httpbin.org/bytes/200000'; // 200KB file
  const url2 = 'https://httpbin.org/bytes/100000'; // 100KB file
  
  try {
    console.log('Running SpeedCompare example...\n');
    
    const results = await tester.compareUrls(url1, url2);
    
    // You can also access individual results
    console.log('\nProgrammatic access to results:');
    results.forEach((result, index) => {
      console.log(`${result.label}: ${(result.speed / 1024).toFixed(2)} KB/s`);
    });
    
  } catch (error) {
    console.error('Example failed:', error.message);
  }
}

if (require.main === module) {
  runExample();
} 