import { createHash } from 'crypto';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

export interface HardwareInfo {
  deviceId: string;
  machineId: string;
  platform: string;
  hostname: string;
  cpus: string;
  totalMemory: number;
}


export class HardwareCheck {
    constructor() {

    }

    private getHardwareInfo(): HardwareInfo {
    const platform = os.platform();
    const hostname = os.hostname();
    const cpuInfo = os.cpus();
    const totalMemory = os.totalmem();
    
    // Create a unique fingerprint based on hardware
    const cpuModel = cpuInfo[0]?.model || 'unknown';
    const cpuCount = cpuInfo.length;
    
    // Combine hardware info into a unique string
    const hardwareString = [
      platform,
      hostname,
      cpuModel,
      cpuCount,
      totalMemory,
      os.arch(),
      os.type()
    ].join('|');
    
    // Create a hash of the hardware info
    const machineId = createHash('sha256')
      .update(hardwareString)
      .digest('hex')
      .substring(0, 32);
    
    // Create a shorter device ID
    const deviceId = `rp_${platform}_${machineId.substring(0, 16)}`;
    
    return {
      deviceId,
      machineId,
      platform,
      hostname,
      cpus: cpuModel,
      totalMemory
    };
  }
  

  public getHardwareInfoPublic(): HardwareInfo {
    return this.getHardwareInfo()
  }
}

export default HardwareCheck;
