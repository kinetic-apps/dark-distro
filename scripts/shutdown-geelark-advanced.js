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

async function runCommand(cmd, ignoreError = false) {
  try {
    const { stdout, stderr } = await execPromise(cmd);
    if (stdout) console.log(stdout.trim());
    if (stderr && !ignoreError) console.error('stderr:', stderr.trim());
    return { success: true, stdout, stderr };
  } catch (error) {
    if (!ignoreError) {
      console.error(`Command failed: ${error.message}`);
    }
    return { success: false, error };
  }
}

async function shutdownPhone() {
  console.log('Advanced Geelark Phone Shutdown Script');
  console.log('=====================================');
  console.log(`Target: ${ip}:${port}`);
  console.log('');

  try {
    // Step 1: Connect to device
    console.log('Step 1: Connecting to device...');
    await runCommand(`adb connect ${ip}:${port}`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Check if device is connected
    const devicesResult = await runCommand('adb devices');
    if (!devicesResult.stdout.includes(`${ip}:${port}`)) {
      throw new Error('Device not connected');
    }
    console.log('✓ Device connected\n');

    // Step 3: Try authentication
    console.log('Step 2: Authenticating...');
    await runCommand(`adb -s ${ip}:${port} shell "echo ${password} | zxlogin"`, true);
    console.log('✓ Authentication attempted\n');

    // Step 4: Check if we have root access
    console.log('Step 3: Checking ROOT access...');
    const rootCheck = await runCommand(`adb -s ${ip}:${port} shell "su -c 'id'"`, true);
    if (rootCheck.success && rootCheck.stdout.includes('uid=0')) {
      console.log('✓ ROOT access confirmed\n');
    } else {
      console.log('⚠️  ROOT access might not be available\n');
    }

    // Step 5: Try various shutdown methods
    console.log('Step 4: Attempting shutdown methods...\n');

    const shutdownMethods = [
      {
        name: 'Method 1: reboot -p (power off)',
        cmd: `adb -s ${ip}:${port} shell "su -c 'reboot -p'"`
      },
      {
        name: 'Method 2: reboot poweroff',
        cmd: `adb -s ${ip}:${port} shell "su -c 'reboot poweroff'"`
      },
      {
        name: 'Method 3: setprop sys.powerctl shutdown',
        cmd: `adb -s ${ip}:${port} shell "su -c 'setprop sys.powerctl shutdown'"`
      },
      {
        name: 'Method 4: am broadcast shutdown intent',
        cmd: `adb -s ${ip}:${port} shell "su -c 'am broadcast -a android.intent.action.ACTION_SHUTDOWN'"`
      },
      {
        name: 'Method 5: Direct poweroff command',
        cmd: `adb -s ${ip}:${port} shell "su -c 'poweroff'"`
      },
      {
        name: 'Method 6: Halt command',
        cmd: `adb -s ${ip}:${port} shell "su -c 'halt'"`
      },
      {
        name: 'Method 7: Init 0',
        cmd: `adb -s ${ip}:${port} shell "su -c 'init 0'"`
      },
      {
        name: 'Method 8: Stop runtime and power off',
        cmd: `adb -s ${ip}:${port} shell "su -c 'stop && setprop sys.powerctl shutdown'"`
      }
    ];

    let success = false;
    for (const method of shutdownMethods) {
      console.log(`Trying ${method.name}...`);
      const result = await runCommand(method.cmd, true);
      
      // Check if device is still responding after a short delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      const checkResult = await runCommand(`adb -s ${ip}:${port} shell "echo test"`, true);
      
      if (!checkResult.success) {
        console.log('✓ Device appears to be shutting down!\n');
        success = true;
        break;
      } else {
        console.log('✗ Device still responding, trying next method...\n');
      }
    }

    if (!success) {
      console.log('Step 5: Trying alternative approaches...\n');
      
      // Try power button simulation
      console.log('Trying power button long press...');
      await runCommand(`adb -s ${ip}:${port} shell "su -c 'input keyevent --longpress KEYCODE_POWER'"`, true);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Try to select power off option if power menu appeared
      console.log('Trying to select power off option...');
      await runCommand(`adb -s ${ip}:${port} shell "su -c 'input keyevent KEYCODE_DPAD_DOWN'"`, true);
      await runCommand(`adb -s ${ip}:${port} shell "su -c 'input keyevent KEYCODE_ENTER'"`, true);
    }

    // Disconnect
    console.log('\nDisconnecting from device...');
    await runCommand(`adb disconnect ${ip}:${port}`);
    console.log('✓ Disconnected\n');

    if (success) {
      console.log('✅ Shutdown command was sent successfully. The phone should be powering off.');
    } else {
      console.log('⚠️  All shutdown methods were attempted. The phone might require manual shutdown.');
      console.log('\nAlternative: You can try using the Geelark API or web interface to stop the phone.');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    // Try to disconnect
    await runCommand(`adb disconnect ${ip}:${port}`, true);
  }
}

// Run the shutdown
shutdownPhone(); 