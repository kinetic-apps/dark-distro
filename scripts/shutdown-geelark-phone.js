#!/usr/bin/env node

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Parse the connection string
const connectionString = process.argv[2] || '128.14.109.187:21089:fb44c3';
const [ip, port, password] = connectionString.split(':');

if (!ip || !port || !password) {
  console.error('Invalid connection string. Expected format: IP:PORT:PASSWORD');
  process.exit(1);
}

async function shutdownPhone() {
  try {
    console.log(`Connecting to Geelark phone at ${ip}:${port}...`);
    
    // Connect to the device
    const connectCmd = `adb connect ${ip}:${port}`;
    console.log(`Running: ${connectCmd}`);
    const { stdout: connectOutput } = await execPromise(connectCmd);
    console.log(connectOutput);
    
    // Wait a moment for connection to establish
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Authenticate with zxlogin
    const authCmd = `adb -s ${ip}:${port} shell "echo ${password} | zxlogin"`;
    console.log('Authenticating with device...');
    try {
      await execPromise(authCmd);
      console.log('Authentication successful');
    } catch (authError) {
      console.log('Authentication might have failed, but continuing...');
    }
    
    // Execute shutdown command with ROOT
    console.log('Executing shutdown command with ROOT...');
    
    // Try multiple shutdown methods
    const shutdownCommands = [
      `adb -s ${ip}:${port} shell "su -c 'reboot -p'"`,
      `adb -s ${ip}:${port} shell "su -c 'shutdown'"`,
      `adb -s ${ip}:${port} shell "su -c 'poweroff'"`,
      `adb -s ${ip}:${port} shell "su -c 'halt'"`,
    ];
    
    let shutdownSuccess = false;
    for (const cmd of shutdownCommands) {
      try {
        console.log(`Trying: ${cmd.replace(password, '***')}`);
        await execPromise(cmd);
        shutdownSuccess = true;
        console.log('✓ Shutdown command executed successfully');
        break;
      } catch (error) {
        console.log(`Command failed, trying next method...`);
      }
    }
    
    if (!shutdownSuccess) {
      console.log('\n⚠️  Standard shutdown commands failed. Trying alternative method...');
      
      // Try using input keyevent for power button long press
      try {
        const powerButtonCmd = `adb -s ${ip}:${port} shell "su -c 'input keyevent --longpress 26'"`;
        await execPromise(powerButtonCmd);
        console.log('✓ Sent long power button press');
      } catch (error) {
        console.error('Power button method also failed');
      }
    }
    
    // Disconnect from device
    const disconnectCmd = `adb disconnect ${ip}:${port}`;
    await execPromise(disconnectCmd);
    console.log('\n✓ Disconnected from device');
    
    console.log('\n✅ Shutdown process completed. The phone should be shutting down now.');
    
  } catch (error) {
    console.error('\n❌ Error during shutdown process:', error.message);
    
    // Try to disconnect even if there was an error
    try {
      await execPromise(`adb disconnect ${ip}:${port}`);
    } catch (disconnectError) {
      // Ignore disconnect errors
    }
  }
}

// Run the shutdown
console.log('Geelark Phone Shutdown Script');
console.log('==============================');
console.log(`Target: ${ip}:${port}`);
console.log('');

shutdownPhone(); 