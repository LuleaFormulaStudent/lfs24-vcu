import {Duplex} from "node:stream";
import {createRawChannel} from "socketcan"
import {Message, RawChannel} from "*can.node";

export default class CanSocket extends Duplex {
    private channel: RawChannel
    private buffer: number[] = []

    constructor(options = {}, channel: string = "can0") {
        super(options);
        this.channel = <RawChannel>createRawChannel(channel)
        this.channel.addListener("onMessage", (msg: Message) => {
            if(!this.push(msg.data, "binary")) {
                this.buffer.push(...Array.from(msg.data))
            }
        });
        this.channel.start()
    }

    _write(chunk: any, encoding: any, callback: Function) {
        const buf = Buffer.from(chunk)
        const chunks = Math.ceil(buf.byteLength / 8)
        for (let i = 0; i <= chunks; i++) {
            this.channel.send({id: 1, ext: false, rtr: false, data: Buffer.from(buf.subarray(i * 8, (i + 1) * 8))});
        }
        callback();
    }

    _read(size: number) {
        if (size <= this.buffer.length) {
            this.push(Buffer.from(this.buffer.slice(0, size)), "binary");
            this.buffer.splice(0, size);
        } else {
            this.push(Buffer.from(this.buffer.slice(0, this.buffer.length)), "binary");
            this.buffer.splice(0, this.buffer.length);
        }
    }

    _final(callback: Function) {
        this.channel.stop()
        callback()
    }
}