import {createRawChannel} from "socketcan"
import {Message} from "*can.node";
import EventEmitter from "node:events";

export default class CanDriver extends EventEmitter {
    private channel: any

    constructor(channel: string = "can0") {
        super();
        this.channel = createRawChannel(channel)
        this.channel.addListener("onMessage", (msg: Message) => {
            const data = [msg.data.readInt16LE(6), msg.data.readInt16LE(4), msg.data.readInt16LE(2), msg.data.readInt16LE(0)]
            this.emit("data", data);
        });
        this.channel.start()
    }
}
