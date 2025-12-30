const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Paths to find adb
const possibleAdbPaths = [
  'C:\\Users\\renan\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe',
  'adb'
];

let adbPath = null;
for (const p of possibleAdbPaths) {
  try {
    if (fs.existsSync(p)) {
      adbPath = p;
      break;
    }
  } catch (e) {
    // Continue
  }
}

if (!adbPath) {
  // Try to find it via where command
  const whereCmd = spawn('where', ['adb']);
  whereCmd.stdout.on('data', (data) => {
    adbPath = data.toString().trim();
  });
}

console.log(`Using adb at: ${adbPath || 'will try system PATH'}`);

// Start logcat on both devices
const devices = ['23013PC75G - 15', 'Medium_Phone_API_36.1(AVD) - 16'];

devices.forEach(device => {
  console.log(`\n=== Starting logcat for ${device} ===`);

  const logFile = `logcat_${device.replace(/\s+/g, '_')}.log`;
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });

  const cmd = adbPath || 'adb';
  const args = ['-s', device, 'logcat'];

  const proc = spawn(cmd, args);

  proc.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[${device}]`, output);
    logStream.write(output);
  });

  proc.stderr.on('data', (data) => {
    console.error(`[${device} Error]`, data.toString());
  });

  proc.on('error', (err) => {
    console.error(`Failed to start logcat for ${device}:`, err);
  });
});

console.log('\nLogcat is now running. Perform these steps on each device:');
console.log('1. Navigate to Edit Profile (pencil icon)');
console.log('2. Tap on photo card to select image');
console.log('3. Choose an image from gallery');
console.log('4. Tap save/confirm button');
console.log('5. Monitor the logs for Firebase operations');
console.log('\nPress Ctrl+C to stop logging\n');

process.on('SIGINT', () => {
  console.log('\nStopping logcat...');
  process.exit(0);
});
