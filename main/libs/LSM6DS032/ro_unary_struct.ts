import {I2CBus} from "i2c-bus";
import * as structjs from "@aksel/structjs"
import {toArrayBuffer} from "../helper_functions.js";
const struct = structjs.default

export default class ROUnaryStruct {

    constructor(private i2c: I2CBus, private i2c_adress: number, private register_address: number, private format: string) {}

    get val(): number {
        const buf = Buffer.alloc(struct(this.format).size)
        this.i2c.readI2cBlockSync(this.i2c_adress, this.register_address, buf.length, buf)
        return struct(this.format).unpack_from(toArrayBuffer(buf), 0)[0]
    }
}