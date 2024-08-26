import {createRawChannel, Message} from "socketcan"
import {Readable} from "node:stream";

export default class CanDriver extends Readable{
    private channel: any

    constructor(channel: string = "can0") {
        super();
        this.channel = createRawChannel(channel)
        this.channel.addListener("onMessage", (msg: any) => {
            this.emit("data", msg);
            this.push(msg["data"])
        });
        this.channel.start()
    }

    send(msg: Message) {
        this.channel.send(msg);
    }
}