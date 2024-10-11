import {createRawChannel} from "socketcan"
import {Message} from "*can.node";
import EventEmitter from "node:events";
import {sleep} from "node-mavlink";

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

        sleep(5000).then(() => {
            this.emit("error", new Error("TEST Error!"))
        })
    }
}
