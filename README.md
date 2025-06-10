# SpeedCompare 🚀

A Node.js application that compares the download speed of files from two URLs.

## Features

- ⚡ Parallel downloads for accurate speed comparison
- 📊 Real-time progress bars during downloads
- 🎨 Colorized output with emojis for better readability
- 📏 Human-readable file sizes and speeds (KB/s, MB/s, etc.)
- 🏆 Clear winner determination with percentage difference
- ⏱️ 30-second timeout protection
- 🔗 Support for both HTTP and HTTPS URLs

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Command Line Interface

```bash
npm start <url1> <url2>
```

Or directly with Node.js:

```bash
node index.js <url1> <url2>
```

### Examples

Compare two image files:
```bash
npm start https://httpbin.org/bytes/1000000 https://httpbin.org/bytes/500000
```

Compare files from different servers:
```bash
npm start https://example.com/largefile.zip https://mirror.example.com/largefile.zip
```

## Sample Output

```
🚀 SpeedCompare - URL Download Speed Comparison Tool

📡 Starting download from URL 1: https://httpbin.org/bytes/1000000
URL 1 [████████████████████████████████] 100% 0.0s 2.1MB bps

📡 Starting download from URL 2: https://httpbin.org/bytes/500000
URL 2 [████████████████████████████████] 100% 0.0s 1.8MB bps

🏁 Download Results:
════════════════════════════════════════════════════════════════════════════════

URL 1 (https://httpbin.org/bytes/1000000):
  📦 File Size: 976.56 KB
  ⏱️  Duration: 0.45 seconds
  🚀 Speed: 2.13 MB/s

URL 2 (https://httpbin.org/bytes/500000):
  📦 File Size: 488.28 KB
  ⏱️  Duration: 0.28 seconds
  🚀 Speed: 1.71 MB/s

📊 Comparison:
────────────────────────────────────────
🏆 Winner: URL 1
Speed advantage: 431.03 KB/s (24.6% faster)

════════════════════════════════════════════════════════════════════════════════
```

## How It Works

1. **Parallel Downloads**: Both URLs are downloaded simultaneously to ensure fair comparison
2. **Progress Tracking**: Real-time progress bars show download progress based on Content-Length header
3. **Speed Calculation**: Download speed is calculated as total bytes divided by download duration
4. **Results Display**: Clear comparison with winner determination and percentage difference

## Requirements

- Node.js 12+ (uses built-in fetch alternatives)
- Internet connection
- URLs that serve downloadable files

## Dependencies

- `chalk` - For colorized terminal output
- `progress` - For download progress bars

## Error Handling

The application handles various error scenarios:
- Invalid URLs
- Network timeouts (30 seconds)
- HTTP error responses
- Connection failures

## Limitations

- Downloads are performed in memory (suitable for files up to a few hundred MB)
- Requires Content-Length header for progress bar display
- Does not resume interrupted downloads

## License

ISC 