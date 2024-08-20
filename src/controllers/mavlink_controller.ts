import {SerialPort} from "serialport";
import {
    common,
    MavLinkDataConstructor,
    MavLinkPacketParser,
    MavLinkPacketRegistry,
    MavLinkPacketSplitter,
    MavLinkProtocolV2,
    minimal,
    registerCustomMessageMagicNumber,
    send
} from 'node-mavlink'
import {Writable} from "node:stream";
import {MavAutopilot, MavModeFlag, MavType} from "mavlink-mappings/dist/lib/minimal.js";
import {Heartbeat} from "node-mavlink-heartbeat";
import {MavLinkData} from "mavlink-mappings";
import {FileTransferProtocolPayloadSerializer, MavFTP} from "node-mavlink-ftp";
import Main from "../../main.js";
import {connect, Socket} from "node:net";
import {MavLinkPacket} from "node-mavlink/dist/lib/mavlink.js";
import {
    MavBatteryChargeState,
    MavBatteryFunction,
    MavBatteryMode,
    MavBatteryType,
    MavFtpOpcode,
    MavParamType
} from "mavlink-mappings/dist/lib/common.js";
import {sleep} from "../helper_functions.js";
import {BrakeData, ComputerStatus, REGISTRY, ThrottleData, VehicleData} from "mavlink-lib/dist/lfs.js"
import fs from "fs";
import fsPromises from "fs/promises"
import path from "path";
import {FileHandle} from "node:fs/promises";

export default class MavlinkController {

    SYS_ID = 1
    COMP_ID = 1
    port: SerialPort | Socket | null = null

    heartbeat: Heartbeat | null = null
    ftp: MavFTP | null = null
    mavlink_protocol: MavLinkProtocolV2
    REGISTRY: MavLinkPacketRegistry = {
        ...minimal.REGISTRY,
        ...common.REGISTRY,
        ...REGISTRY
    }

    port_ready = false

    mav_messages_interval_times: { [propName: number]: number } = {}
    mav_messages_intervals: { [propName: number]: any } = {}

    ftp_sequence = 0
    ftp_session = 1
    ftp_serializer: FileTransferProtocolPayloadSerializer
    ftp_write_file_name: string = ""
    ftp_file_handler: FileHandle | null = null

    constructor(private main: Main) {
        for (const message of Object.values(REGISTRY)) {
            registerCustomMessageMagicNumber((message as MavLinkDataConstructor<MavLinkData>).MSG_ID.toString(),
                (message as MavLinkDataConstructor<MavLinkData>).MAGIC_NUMBER)
        }
        this.mavlink_protocol = new MavLinkProtocolV2(this.SYS_ID, this.COMP_ID)
        this.ftp_serializer = new FileTransferProtocolPayloadSerializer()
    }

    async init() {
        await this.main.logs_controller.debug("Mavlink controller starting initializing!")

        if (this.main.in_production) {
            this.port = new SerialPort({path: "/dev/ttyAMA2", baudRate: 57600});
        } else {
            this.port = connect({host: '0.0.0.0', port: 5432})
        }

        this.ftp = new MavFTP(<Writable>this.port, {protocol: this.mavlink_protocol})
        this.heartbeat = new Heartbeat(<Writable>this.port, {protocol: this.mavlink_protocol})

        this.heartbeat.type = MavType.GROUND_ROVER
        this.heartbeat.autopilot = MavAutopilot.GENERIC
        this.heartbeat.baseMode = MavModeFlag.MANUAL_INPUT_ENABLED
        this.heartbeat.systemStatus = this.main.data_controller.params.system_state

        try {
            this.port
                .pipe(new MavLinkPacketSplitter())
                .pipe(new MavLinkPacketParser())
                .pipe(this.heartbeat)
                .pipe(this.ftp)
                .on('data', async (packet: MavLinkPacket) => {
                    try {
                        const clazz: MavLinkDataConstructor<MavLinkData> = this.REGISTRY[packet.header.msgid]
                        if (clazz) {
                            const packet_data = packet.protocol.data(packet.payload, clazz)
                            //@ts-ignore
                            if (packet_data.hasOwnProperty("targetSystem") && packet_data["targetSystem"]! == this.SYS_ID && packet_data.hasOwnProperty("targetComponent") && packet_data["targetComponent"] == this.COMP_ID) {
                                await this.handle_packet(packet_data)
                            } else {
                                await this.handle_packet(packet_data)
                            }
                        }
                    } catch (e) {
                        await this.main.logs_controller.error("Error with data parsing:", e)
                    }
                })
                .on("error", (err) => {
                    this.main.logs_controller.error("Pipeline Error:", err)
                })
        } catch (e) {
            console.error(e)
        }

        if (this.port instanceof SerialPort) {
            this.port.on('open', () => {
                this.on_port_ready()
            })
        } else {
            this.port.on('connect', () => {
                this.on_port_ready()
            })
        }

        await this.main.logs_controller.debug("Mavlink controller initialized!")
    }

    async on_port_ready() {
        this.heartbeat!.start()
        this.port_ready = true

        this.createMsgInterval(common.BatteryStatus.MSG_ID, 500)
        this.createMsgInterval(VehicleData.MSG_ID, 100)
        this.createMsgInterval(ThrottleData.MSG_ID, 100)
        this.createMsgInterval(BrakeData.MSG_ID, 100)
        this.createMsgInterval(common.GpsRawInt.MSG_ID, 500)
        this.createMsgInterval(common.RawImu.MSG_ID, 100)
        this.createMsgInterval(ComputerStatus.MSG_ID, 1000)
    }

    async send(msg: MavLinkData | MavLinkData[], wait_time: number = 10): Promise<boolean> {
        if (this.port_ready) {
            if (msg instanceof MavLinkData) {
                try {
                    if (this.ftp_write_file_name != "" && (msg instanceof common.FileTransferProtocol || msg instanceof common.StatusText)) {
                        await send(<Writable>this.port, msg, this.mavlink_protocol)
                    } else if (this.ftp_write_file_name == "") {
                        await send(<Writable>this.port, msg, this.mavlink_protocol)
                    }
                    return true
                } catch (e) {
                    await this.main.logs_controller.error("Error when sending msg (" + msg.constructor.name + "): ", e)
                    return false
                }
            } else {
                for (const m of msg) {
                    try {

                        await this.send(m)
                        await sleep(wait_time)
                    } catch (e) {
                        await this.main.logs_controller.error("Error when sending msg (" + msg.constructor.name + "): ", e)
                        return false
                    }
                }
            }
            return true
        }
        return false
    }

    async handle_packet(data: MavLinkData) {
        if (data instanceof common.ParamRequestList) {
            const params_keys: string[] = this.main.data_controller.getParams()
            for (let i = 0; i < params_keys.length; i++) {
                await this.send(this.create_param_msg(params_keys[i], i, params_keys.length))
                await sleep(100)
            }
        } else if (data instanceof common.ParamRequestRead) {
            await this.send(this.create_param_msg(data.paramId, data.paramIndex))
        } else if (data instanceof common.ParamSet) {
            try {
                this.main.data_controller.params[data.paramId] = data.paramValue
                await this.send(this.create_param_msg(data.paramId, 0))
            } catch (e: any) {
                await this.main.logs_controller.error("Error setting parameter: " + data.paramId + " = " + data.paramValue + ". " + e.toString())
            }
        } else if (data instanceof common.LogRequestList) {
            await this.main.logs_controller.onLogListRequest(data.start, data.end)
        } else if (data instanceof common.CommandLong && data.command == common.MavCmd.SET_MESSAGE_INTERVAL) {
            this.createMsgInterval(data._param1, data._param2)
        } else if (data instanceof common.RadioStatus) {
            this.main.data_controller.params.radio_rssi = data.rssi
            this.main.data_controller.params.radio_remrssi = data.remrssi
            this.main.data_controller.params.radio_txbuf = data.txbuf
            this.main.data_controller.params.radio_noise = data.noise
            this.main.data_controller.params.radio_remnoise = data.remnoise
            this.main.data_controller.params.radio_rxerrors = data.rxerrors
            this.main.data_controller.params.radio_fixed = data.fixed
            await this.send(data)
        } else if (data instanceof common.FileTransferProtocol) {
            await this.onFTPEvent(data)
        }else {
            await this.main.logs_controller.warning('Received packet:' + data.toString())
        }
    }

    private create_param_msg(param_key: string, index = 1, count = 1): common.ParamValue {
        const msg = new common.ParamValue()
        msg.paramId = param_key
        msg.paramCount = count
        msg.paramIndex = index

        if (typeof this.main.data_controller.params[param_key] == "number") {
            if (Number.isInteger(this.main.data_controller.params[param_key])) {
                msg.paramType = MavParamType.INT32
            } else {
                msg.paramType = MavParamType.REAL32
            }
            msg.paramValue = this.main.data_controller.params[param_key]
        } else if (typeof this.main.data_controller.params[param_key] == "boolean") {
            msg.paramType = MavParamType.UINT8
            msg.paramValue = this.main.data_controller.params[param_key] ? 1 : 0
        } else {
            msg.paramType = MavParamType.INT32
            msg.paramValue = this.main.data_controller.params[param_key]
        }
        return msg
    }

    createMsgInterval(msg_id: number, interval: number) {
        this.mav_messages_intervals[msg_id] = setInterval(async () => {
            const msg = this.createFromMsgID(msg_id)
            if (msg) {
                await this.send(msg)
            }
        }, interval)
        this.mav_messages_interval_times[msg_id] = interval
    }

    private createFromMsgID(msg_id: number): MavLinkData | MavLinkData[] | null {
        try {
            switch (msg_id) {
                case common.BatteryStatus.MSG_ID: {
                    const lv_battery_msg = new common.BatteryStatus()
                    lv_battery_msg.id = 0
                    lv_battery_msg.batteryFunction = MavBatteryFunction.AVIONICS
                    lv_battery_msg.type = MavBatteryType.LIFE
                    lv_battery_msg.batteryRemaining = Math.round(this.main.data_controller.params.lv_bdi * 100)
                    lv_battery_msg.chargeState = MavBatteryChargeState.UNDEFINED
                    lv_battery_msg.currentBattery = this.main.data_controller.params.lv_cur_amp
                    lv_battery_msg.timeRemaining = 0
                    lv_battery_msg.temperature = this.main.data_controller.params.lv_cur_temp * 100
                    lv_battery_msg.currentConsumed = this.main.data_controller.params.lv_cons_cap
                    lv_battery_msg.energyConsumed = this.main.data_controller.params.lv_cons_energy
                    lv_battery_msg.mode = MavBatteryMode.UNKNOWN
                    lv_battery_msg.voltages[0] = this.main.data_controller.params.lv_cur_voltage

                    const hv_battery_msg = new common.BatteryStatus()
                    hv_battery_msg.id = 1
                    hv_battery_msg.batteryFunction = MavBatteryFunction.PROPULSION
                    hv_battery_msg.type = MavBatteryType.LIFE
                    hv_battery_msg.batteryRemaining = Math.round(this.main.data_controller.params.hv_bdi * 100)
                    hv_battery_msg.chargeState = MavBatteryChargeState.UNDEFINED
                    hv_battery_msg.currentBattery = this.main.data_controller.params.hv_cur_amp
                    hv_battery_msg.timeRemaining = 0
                    hv_battery_msg.temperature = this.main.data_controller.params.hv_cur_temp * 100
                    hv_battery_msg.currentConsumed = this.main.data_controller.params.hv_cons_cap
                    hv_battery_msg.energyConsumed = this.main.data_controller.params.hv_cons_energy
                    hv_battery_msg.mode = MavBatteryMode.UNKNOWN
                    hv_battery_msg.voltages[0] = this.main.data_controller.params.hv_cur_voltage

                    return [lv_battery_msg, hv_battery_msg]
                }
                case common.GpsRawInt.MSG_ID: {
                    const gps_msg = new common.GpsRawInt()
                    gps_msg.alt = this.main.data_controller.params.gps_altitude * 1000
                    gps_msg.eph = this.main.data_controller.params.gps_hdop * 100
                    gps_msg.lon = this.main.data_controller.params.gps_longitude * 10 ** 7
                    gps_msg.lat = this.main.data_controller.params.gps_latitude * 10 ** 7
                    gps_msg.vel = this.main.data_controller.params.gps_speed * 100
                    return gps_msg
                }
                case ThrottleData.MSG_ID: {
                    const throttle_msg = new ThrottleData()
                    throttle_msg.raw = this.main.data_controller.params.throttle_raw
                    throttle_msg.input = this.main.data_controller.params.throttle_input
                    throttle_msg.output = this.main.data_controller.params.throttle_output
                    return throttle_msg
                }
                case BrakeData.MSG_ID: {
                    const brake_msg = new BrakeData()
                    brake_msg.raw = this.main.data_controller.params.brake_raw
                    brake_msg.input = this.main.data_controller.params.brake_input
                    brake_msg.output = this.main.data_controller.params.brake_output
                    return brake_msg
                }
                case VehicleData.MSG_ID: {
                    const msg = new VehicleData()
                    msg.power = this.main.data_controller.params.vehicle_power
                    msg.speed = this.main.data_controller.params.vehicle_speed
                    msg.heading = this.main.data_controller.params.vehicle_heading
                    msg.steering = this.main.data_controller.params.vehicle_steering
                    return msg
                }
                case common.RawImu.MSG_ID: {
                    const msg = new common.RawImu()
                    msg.xacc = this.main.data_controller.params.acc_lat * 1000
                    msg.yacc = this.main.data_controller.params.acc_lon * 1000
                    msg.zacc = this.main.data_controller.params.acc_z * 1000
                    msg.xgyro = this.main.data_controller.params.gyro_lat * 1000
                    msg.ygyro = this.main.data_controller.params.gyro_lon * 1000
                    msg.zgyro = this.main.data_controller.params.gyro_z * 1000
                    msg.temperature = this.main.data_controller.params.imu_temp * 100
                    return msg
                }
                case common.ScaledImu.MSG_ID: {
                    const msg = new common.ScaledImu()
                    msg.xacc = this.main.data_controller.params.acc_lat * 1000 / this.main.data_controller.params.g_constant
                    msg.yacc = this.main.data_controller.params.acc_lon * 1000 / this.main.data_controller.params.g_constant
                    msg.zacc = this.main.data_controller.params.acc_z * 1000 / this.main.data_controller.params.g_constant
                    msg.xgyro = this.main.data_controller.params.gyro_lat * 1000
                    msg.ygyro = this.main.data_controller.params.gyro_lon * 1000
                    msg.zgyro = this.main.data_controller.params.gyro_z * 1000
                    msg.temperature = this.main.data_controller.params.imu_temp * 100
                    return msg
                }
                case ComputerStatus.MSG_ID: {
                    const msg = new ComputerStatus()
                    msg.uptime = this.main.uptime
                    msg.cpuCore = this.main.data_controller.params.cpu_cores
                    msg.temperatureCore = this.main.data_controller.params.cpu_temp * 100
                    msg.temperatureBoard = this.main.data_controller.params.board_temp * 100
                    msg.gpuCore = this.main.data_controller.params.gpu_cores
                    msg.type = this.main.data_controller.params.computer_type
                    msg.ramUsage = this.main.data_controller.params.ram_usage
                    msg.ramTotal = this.main.data_controller.params.ram_total
                    msg.storageType = this.main.data_controller.params.storage_type
                    msg.storageUsage = this.main.data_controller.params.storage_usage
                    msg.storageTotal = this.main.data_controller.params.storage_total
                    return msg
                }
                default: {
                    return []
                }
            }
        } catch (e) {
            this.main.logs_controller.error("Error when creating msg:", e)
            return null
        }
    }

    ftpPayload(
        opcode: common.MavFtpOpcode,
        data: Uint8Array | string | number = new Uint8Array(0),
        offset = 0
    ): common.FileTransferProtocol {
        const result: common.FileTransferProtocol = new common.FileTransferProtocol()
        result.targetNetwork = 0
        result.targetSystem = 1
        result.targetComponent = 1

        result.payload = [...this.ftp_serializer.serialize({
            seq: this.ftp_sequence,
            session: this.ftp_session,
            opcode,
            size: typeof data === 'number' ? data : data.length,
            burstComplete: 0,
            data: typeof data === 'string' ? new TextEncoder().encode(data) : typeof data === 'number' ? new Uint8Array(0) : data,
            offset
        })]

        return result
    }

    async onFTPEvent(data: common.FileTransferProtocol) {
        const payload = this.ftp_serializer.deserialize(Buffer.from(data.payload))
        this.ftp_sequence = payload.seq

        if (payload.opcode == MavFtpOpcode.CREATEFILE) {
            const textDecoder = new TextDecoder()
            const file_name = textDecoder.decode(payload.data)
            await this.main.logs_controller.info("Got request for upload file: " + file_name)
            this.ftp_write_file_name = path.join("data", file_name)
            const directory = path.dirname(this.ftp_write_file_name)
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory)
            } else if (fs.existsSync(this.ftp_write_file_name)) {
                await this.main.logs_controller.info("Removing old firmware file..")
                fs.unlinkSync(this.ftp_write_file_name)
            }
            this.ftp_file_handler = await fsPromises.open(this.ftp_write_file_name, "w+");
            this.ftp_session = Math.round(Math.random()*255)
            await this.send(this.ftpPayload(MavFtpOpcode.ACK))
        } else if (payload.opcode == MavFtpOpcode.WRITEFILE) {
            if (this.ftp_write_file_name && this.ftp_file_handler && payload.session == this.ftp_session) {
                fs.appendFileSync(this.ftp_write_file_name, payload.data)
                await this.ftp_file_handler.write(payload.data, 0, payload.data.length, payload.offset);
                await this.send(this.ftpPayload(MavFtpOpcode.ACK))
            }
        } else if (payload.opcode == MavFtpOpcode.TERMINATESESSION) {
            if (payload.session == this.ftp_session) {
                this.ftp_session = 0
                await this.main.logs_controller.info("Terminating FTP session.")
                await this.send(this.ftpPayload(MavFtpOpcode.ACK))
                this.ftp_file_handler?.close()
                await this.main.handleNewFirmware(this.ftp_write_file_name)
                this.ftp_write_file_name = ""
            }
        }
    }
}