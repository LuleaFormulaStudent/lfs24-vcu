import {createRawChannel} from "socketcan"
import {Readable} from "node:stream";
import {Message} from "*can.node";

export default class CanDriver extends Readable{
    private channel: any

    constructor(channel: string = "can0") {
        super();
        this.channel = createRawChannel(channel)
        this.channel.addListener("onMessage", (msg: Message) => {
            console.log(msg.data)
            this.emit("data", [msg.data.readInt16LE(6), msg.data.readInt16LE(4), msg.data.readInt16LE(2), msg.data.readInt16LE()]);
        });
        this.channel.start()
    }

    send(msg: Message) {
        this.channel.send(msg);
    }

    _read(size: number) {}
}