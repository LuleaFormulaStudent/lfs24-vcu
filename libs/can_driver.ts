import {createRawChannel} from "socketcan"
import {Readable} from "node:stream";
import {Message} from "*can.node";

export default class CanDriver extends Readable{
    private channel: any

    constructor(channel: string = "can0") {
        super();
        this.channel = createRawChannel(channel)
        this.channel.addListener("onMessage", (msg: Message) => {
            this.emit("data", msg);
            if (!this.push(msg.data)) {
                this.channel.stop();
            }
        });
        this.on('drain', () => {
            this.channel.start();
        });
        this.channel.start()
    }

    send(msg: Message) {
        this.channel.send(msg);
    }

    _read(size: number) {}
}