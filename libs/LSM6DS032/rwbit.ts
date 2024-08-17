import {I2CBus} from "i2c-bus";

export default class RWBit {

    bit_mask: number

    constructor(private i2c: I2CBus, private i2c_adress: number, private register_address: number, bit: number) {
        this.bit_mask = 1 << (bit % 8)
    }

    get val(): boolean {
        const buf = Buffer.alloc(1)
        this.i2c.readI2cBlockSync(this.i2c_adress, this.register_address, buf.length, buf)
        return (buf[0] & this.bit_mask) == this.bit_mask
    }

    set val(value: boolean) {
        const buf = Buffer.alloc(1)
        this.i2c.readI2cBlockSync(this.i2c_adress, this.register_address, buf.length, buf)
        if (value) {
            buf[0] |= this.bit_mask
        } else {
            buf[0] &= ~this.bit_mask
        }
        this.i2c.i2cWriteSync(this.i2c_adress, buf.length, buf)
    }

}