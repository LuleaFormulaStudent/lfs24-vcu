import {I2CBus} from "i2c-bus";

export default class ROBit {

    bit_mask: number
    byte: number
    constructor(private i2c: I2CBus, private i2c_adress: number, private register_address: number, bit: number,
                register_width: number = 1, lsb_first: boolean = true) {
        if (lsb_first) {
            this.byte = Math.floor(bit / 8) + 1
        } else {
            this.byte = register_width - Math.floor(bit / 8)
        }
        this.bit_mask = 1 << (bit % 8)
    }

    get val(): boolean {
        const buf = Buffer.alloc(1)
        this.i2c.readI2cBlockSync(this.i2c_adress, this.register_address, buf.length, buf)
        return (buf[this.byte] & this.bit_mask) == this.bit_mask
    }

}