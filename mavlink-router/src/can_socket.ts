import {Duplex} from "node:stream";
import {createRawChannel} from "socketcan"
import {Message, RawChannel} from "*can.node";

interface mavlink_msg {
    fin_length: number,
    data: Buffer,
    offset: number
}

export default class CanSocket extends Duplex {
    private channel: RawChannel
    private msg_buffer: mavlink_msg[] = []
    private buffer: { [propName: number]: mavlink_msg } = {}

    constructor(options = {}, channel: string = "can0") {
        super(options);
        this.channel = <RawChannel>createRawChannel(channel)
        this.channel.addListener("onMessage", (msg: Message) => {
            try {
                if (msg.data[0] == 0xFD) {
                    this.buffer[msg.id] = {
                        fin_length: msg.data[1] + 12,
                        data: Buffer.alloc(msg.data[1] + 12),
                        offset: 0,
                    }
                }
                if (msg.data.byteLength > 0) {
                    this.buffer[msg.id].data.fill(msg.data, this.buffer[msg.id].offset)
                    this.buffer[msg.id].offset += msg.data.byteLength
                }
                if (this.buffer[msg.id].offset == this.buffer[msg.id].fin_length && !this.push(this.buffer[msg.id].data, "binary")) {
                    this.msg_buffer.push(this.buffer[msg.id])
                }
            } catch (e) {
                console.error(e)
                console.log(this.buffer[msg.id])
                console.log(msg)
            }
        });
        this.channel.start()
    }

    _write(chunk: any, encoding: any, callback: Function) {
        const buf = Buffer.from(chunk)
        const chunks = Math.ceil(buf.byteLength / 8)
        for (let i = 0; i < chunks; i++) {
            this.channel.send({id: 1, ext: false, rtr: false, data: Buffer.from(buf.subarray(i * 8, (i + 1) * 8))});
        }
        callback();
    }

    _read(size: number) {
        for (let i = 0; i < this.msg_buffer.length; i++) {
            this.push(this.msg_buffer[i].data, "binary");
        }
    }

    _final(callback: Function) {
        this.channel.stop()
        callback()
    }
}
