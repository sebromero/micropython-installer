import { SerialPort } from 'serialport'
import fetch from 'node-fetch';
import fs from 'fs';
import os from 'os';
import path from 'path';

export class Device {
    constructor(vendorID, productID, deviceDescriptor, serialPort, serialNumber = null, mountPoint = null) {
        this.vendorID = vendorID;
        this.productID = productID;
        this.deviceDescriptor = deviceDescriptor;
        this.serialNumber = serialNumber;
        this.serialPort = serialPort;
        this.mountPoint = mountPoint;
    }

    async getUPythonFirmwareUrl() {
        const fileExtension = this.deviceDescriptor.firmwareExtension;
        const boardName = this.deviceDescriptor.firmwareID;
        console.log(`🔍 Finding latest firmware for board '${boardName}' ...`);

        const jsonUrl = "https://downloads.arduino.cc/micropython/index.json";
        const response = await fetch(jsonUrl);
        const data = await response.json();

        // Find the board with the given name
        const boards = data.boards.filter((board) => board.name === boardName);

        if (boards.length === 0) {
            return null;
        } else {
            const boardData = boards[0];

            // Find the first release that matches the desired file extension
            const releaseData = boardData.releases.find((release) =>
                release.url.endsWith("." + fileExtension)
            );

            return "https://downloads.arduino.cc" + releaseData.url;
        }
    }

    async downloadFirmware(firmwareUrl) {
        console.log(`🔗 Firmware URL: ${firmwareUrl}`);
        console.log(`🌐 Downloading firmware ...`);

        // Extract the file name from the URL
        const fileName = firmwareUrl.split("/").pop();
        const targetFile = path.join(os.tmpdir(), fileName);

        // Download the file and save it to disk
        const response = await fetch(firmwareUrl);
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(targetFile, Buffer.from(buffer));

        return targetFile;
    }

    async flashFirmware(firmwareFile) {
        console.log(`🔥 Flashing firmware ...`);
        return this.deviceDescriptor.onFlashFirmware(firmwareFile, this);
    }

    async sendREPLCommand(command, awaitResponse = true) {
        // console.log(`📤 Sending REPL command: ${command}`);
        
        return new Promise((resolve, reject) => {
            let responseData = "";
            // For MicroPython devices, we need to open the serial port with a baud rate of 115200
            const serialport = new SerialPort({ path: this.serialPort, baudRate: 115200, autoOpen : false } );
            
            serialport.open(function (err) {
                if (err) {
                    return console.log('❌ Error opening port: ', err.message)
                }
                
                serialport.write(command, function (err) {
                    if (err) {
                        return console.log('❌ Error on write: ', err.message)
                    }
                });
    
                if(!awaitResponse) {
                    if(serialport.isOpen) serialport.close();
                    resolve();
                    return;
                }
            });
    
            // Read response
            serialport.on('data', function (data) {
                responseData += data.toString();
                let lines = responseData.split('\r\n');
                let lastLine = lines[lines.length - 1];
                
                if(lastLine === ">>> ") {
                    serialport.close();
                    resolve(responseData);
                }
            });
        });
    }

    async flashMicroPythonFirmware() {
        const firmwareUrl = await this.getUPythonFirmwareUrl();
        const firmwareFile = await this.downloadFirmware(firmwareUrl);

        console.log(`🔥 Flashing firmware ...`);
        if (this.deviceDescriptor.onFlashUPythonFirmware) {
            await this.deviceDescriptor.onFlashUPythonFirmware(firmwareFile, this);
        }
        await this.deviceDescriptor.onFlashFirmware(firmwareFile, this);
    }

    async enterBootloader() {
        console.log(`👢 Entering bootloader ...`);
        if (!this.runsMicroPython()) {
            // Open the serial port with a baud rate of 1200
            const serialport = new SerialPort({ path: this.serialPort, baudRate: 1200, autoOpen: false });
            serialport.on('open', function () {
                serialport.close();
            });

            serialport.open(function (err) {
                if (err) {
                    return console.log('❌ Error opening port: ', err.message)
                }
            });
        } else {
            // FIXME doesnt seem to work
            await this.sendREPLCommand('import machine; machine.bootloader()\r\n', false);
        }
    }

    runsMicroPython() {
        return this.productID === this.deviceDescriptor.productIDs.upythonPID;
    }

    runsBootloader() {
        return this.productID === this.deviceDescriptor.productIDs.bootloaderPID;
    }

    // Function to convert the vendor /product ID to a hex string wihtout the 0x prefix.
    // The number is padded with a 0 if it is less than 4 digits long.
    convertNumberToHex(anID) {
        return "0x" + anID.toString(16).padStart(4, '0');
    }

    getVendorIDHex() {
        return this.convertNumberToHex(this.vendorID);
    }

    getProductIDHex() {
        return this.convertNumberToHex(this.productID);
    }

    async getMicroPythonVersion() {
        const versionData = await this.sendREPLCommand('import sys; print(sys.implementation.version)\r\n');
        const lines = versionData.trim().split('\r\n');
        // Find the line that starts with a '(' which contains the version string e.g. (1, 19, 1)
        const versionStringLine = lines.find((line) => line.startsWith('('));
        if (!versionStringLine) {
            console.log(`❌ Could not find version string in response: ${versionData}`);
            return null;
        }
        const versionString = versionStringLine.split(', ').join('.');
        // Remove the parentheses from the version string
        return versionString.substring(1, versionString.length - 1);
    }

}

export default Device;