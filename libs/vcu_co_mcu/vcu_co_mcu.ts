import {I2CBus} from "i2c-bus";
import os from "os";

export default class VCUCoMcu {
    private i2c_device: I2CBus

    constructor(private adress: number = 12, private bus_num: number = 1) {
        if (os.arch() == "arm") {
            this.i2c_device = require("i2c-bus").openSync(this.bus_num)
        }
    }

    async read_analog_sensors() {
        const buffer = Buffer.alloc(3)
        this.i2c_device.readI2cBlockSync(this.adress, 123, 3, buffer)
        return [buffer.readUInt8(2), buffer.readUInt8(1), buffer.readUInt8(0)]
    }

    async read_ind_sensors() {
        const buffer = Buffer.alloc(8)
        this.i2c_device.readI2cBlockSync(this.adress, 124, 8, buffer)

        return [buffer.readUInt16LE(6), buffer.readUInt16LE(4), buffer.readUInt16LE(2), buffer.readUInt16LE(0)]
    }
}
