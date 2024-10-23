import {createServer, Server, Socket} from "node:net";
import {
    common,
    MavLinkData,
    MavLinkDataConstructor,
    MavLinkPacket,
    MavLinkPacketParser,
    MavLinkPacketRegistry,
    MavLinkPacketSplitter,
    MavLinkProtocolV2,
    minimal,
    registerCustomMessageMagicNumber,
    send
} from "node-mavlink";
import package_info from "./package.json"
import LogsController from "./logs_controller";
import {SerialPort} from "serialport";
import {REGISTRY} from "mavlink-lib/typescript/lfs"
import {Writable} from "node:stream";
import {MavComponent} from "mavlink-mappings/dist/lib/minimal";

export default class MavlinkRouter {

    tcp_server: Server

    tcp_server_stared = false

    logs_controller: LogsController

    in_production: boolean = process.env.NODE_ENV == 'production'
    version: string = package_info.version

    connections: {
        sys_id: number,
        comp_id: number,
        conn: Socket | SerialPort,
        is_slow: boolean,
        backlog_interval: any | null
    }[] = []

    slow_connections_backlog: {
        [propName: string]: { msg: MavLinkData, from_sys_id: number, from_comp_id: number }[]
    } = {}
    slow_connection_interval = parseInt(process.env.MLR_SLOW_CONNECTION_INTERVAL || "15")
    serial_devices = (process.env.MLR_SERIAL_DEVICES || "").split(",").map(device => device.trim())

    REGISTRY: MavLinkPacketRegistry = {
        ...minimal.REGISTRY,
        ...common.REGISTRY,
        ...REGISTRY
    }

    constructor() {
        this.tcp_server = createServer()
        this.logs_controller = new LogsController(this)

        for (const message of Object.values(REGISTRY)) {
            registerCustomMessageMagicNumber((message as MavLinkDataConstructor<MavLinkData>).MSG_ID.toString(),
                (message as MavLinkDataConstructor<MavLinkData>).MAGIC_NUMBER)
        }
    }

    async init() {
        this.logs_controller.info("Initiating mavlink router..")
        this.logs_controller.info("Version: " + this.version)

        this.tcp_server.on('connection', (socket) => {
            this.setupConnection(socket, false)
            this.logs_controller.info("New tcp connection.")
        });

        this.tcp_server.listen({port: 5432, host: "0.0.0.0"}, () => {
            this.logs_controller.info("TCP Server started!")
            this.tcp_server_stared = true
        });

        for (const path of this.serial_devices) {
            if (path) {
                this.logs_controller.info("Registered new port: " + path)
                const port = new SerialPort({path, baudRate: 57600});
                this.setupConnection(port, true)
            }
        }
    }

    toConnID(sys_id: number, comp_id: number): string {
        return sys_id.toString() + "|" + comp_id.toString();
    }

    setupConnection(connection: Socket | SerialPort, slow_connection: boolean = false) {
        connection
            .pipe(new MavLinkPacketSplitter())
            .pipe(new MavLinkPacketParser())
            .resume()
            .on("data", async (packet: MavLinkPacket) => {
                try {
                    if (connection.destroyed || connection.writableFinished) {
                        return
                    }

                    const clazz: MavLinkDataConstructor<MavLinkData> = this.REGISTRY[packet.header.msgid]
                    if (clazz) {
                        const packet_data = packet.protocol.data(packet.payload, clazz)
                        const from_system: number = packet.header.sysid
                        const from_component: MavComponent = packet.header.compid
                        const target_system: number = "targetSystem" in packet_data ? packet_data["targetSystem"] as any : 0
                        const target_component: MavComponent = "targetComponent" in packet_data ? packet_data["targetComponent"] as any : MavComponent.ALL

                        if (packet_data instanceof minimal.Heartbeat
                            && !this.connections.find(({
                                                           sys_id,
                                                           comp_id
                                                       }) => sys_id === from_system && comp_id === from_component)) {
                            if (slow_connection) {
                                this.slow_connections_backlog[this.toConnID(from_system, from_component)] = []
                            }

                            this.connections.push({
                                sys_id: from_system,
                                comp_id: from_component,
                                conn: connection,
                                is_slow: slow_connection,
                                backlog_interval: slow_connection ? setInterval(() => {
                                    if (!(connection.destroyed || connection.writableFinished)
                                        && this.slow_connections_backlog[this.toConnID(from_system, from_component)].length) {
                                        //console.log(this.slow_connections_backlog[this.toConnID(from_system, from_component)].length)
                                        const {
                                            msg,
                                            from_sys_id,
                                            from_comp_id
                                        } = this.slow_connections_backlog[this.toConnID(from_system, from_component)].shift()!
                                        this.send(connection, msg, from_sys_id, from_comp_id)
                                    }
                                }, this.slow_connection_interval) : null
                            })

                            this.logs_controller.debug("Added new connection: " + `SYS ID: ${from_system} | COMP ID: ${from_component}`)
                        }

                        if (target_system > 0) {
                            for (let i = 0; i < this.connections.length; i++) {
                                if (this.connections[i].conn !== connection
                                    && this.connections[i].sys_id == target_system
                                    && (target_component == 0 || this.connections[i].comp_id == target_component)) {
                                    if (this.connections[i].is_slow) {
                                        this.slow_connections_backlog[this.toConnID(this.connections[i].sys_id, this.connections[i].comp_id)].push({
                                            msg: packet_data,
                                            from_sys_id: from_system,
                                            from_comp_id: from_component
                                        })
                                    } else {
                                        await this.send(this.connections[i].conn, packet_data, from_system, from_component)
                                    }
                                }
                            }
                        } else {
                            for (let i = 0; i < this.connections.length; i++) {
                                if (this.connections[i].conn !== connection) {
                                    if (this.connections[i].is_slow) {
                                        this.slow_connections_backlog[this.toConnID(this.connections[i].sys_id, this.connections[i].comp_id)].push({
                                            msg: packet_data,
                                            from_sys_id: from_system,
                                            from_comp_id: from_component
                                        })
                                    } else {
                                        await this.send(this.connections[i].conn, packet_data, from_system, from_component)
                                    }
                                }
                            }
                        }
                        await this.logs_controller.debug(`Got ${packet_data.constructor.name} from: ${packet.header.sysid}|${packet.header.compid} to ${target_system}|${target_component}, (${packet.header.payloadLength} bytes)`)
                    }
                } catch (e) {
                    this.logs_controller.error("Error with packet parsing when routing:", e)
                }
            })

        connection.on('close', () => {
            const conn_index = this.connections.findIndex(({conn}) => connection == conn)

            if (conn_index >= 0) {
                this.logs_controller.debug("Removed connection: " + `SYS ID: ${this.connections[conn_index].sys_id} | COMP ID: ${this.connections[conn_index].comp_id}`)
                if (slow_connection) {
                    this.slow_connections_backlog[this.toConnID(this.connections[conn_index].sys_id, this.connections[conn_index].comp_id)] = []
                    clearInterval(this.connections[conn_index].backlog_interval)
                }
                this.connections.splice(this.connections.findIndex(({conn}) => connection == conn), 1)
            } else {
                this.logs_controller.error("Tried to remove a connection that did not exist.")
            }
        });

        connection.on("error", (err) => {
            this.logs_controller.error("Error on routing message", err)
        })
    }

    async send(conn: Socket | SerialPort, msg: MavLinkData, from_sys_id: number, from_comp_id: number): Promise<boolean> {
        try {
            await send(<Writable>conn, msg, new MavLinkProtocolV2(from_sys_id, from_comp_id))
            return true
        } catch (e) {
            this.logs_controller.error("Error when routing msg (" + msg.constructor.name + "): ", e)
            return false
        }
    }
}

(new MavlinkRouter().init()).catch(console.error)
