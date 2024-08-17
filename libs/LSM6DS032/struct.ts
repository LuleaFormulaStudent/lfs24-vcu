import {I2CBus} from "i2c-bus";
import * as structjs from "@aksel/structjs"
import {toArrayBuffer} from "../../src/helper_functions.js";
const struct = structjs.default

export default class Struct {

    constructor(private i2c: I2CBus, private i2c_adress: number, private register_address: number, private format: string) {}

    get val(): number[] {
        const buf = Buffer.alloc(struct(this.format).size)
        this.i2c.readI2cBlockSync(this.i2c_adress, this.register_address, buf.length, buf)
        return struct(this.format).unpack_from(toArrayBuffer(buf), 0)
    }

    set val(value: number[]) {
        const buf = new ArrayBuffer(1 + struct(this.format).size)
        const view = new Uint8Array(buf)
        view.set([this.register_address], 0)
        struct(this.format).pack_into(buf, 1, value)
        this.i2c.i2cWriteSync(this.i2c_adress, buf.byteLength, Buffer.from(buf))
    }
}